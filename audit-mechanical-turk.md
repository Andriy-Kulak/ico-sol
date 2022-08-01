## **[Q1]** Unused contract property

On line 17, `SpaceCoinICO.sol` has the following code:

    `address public treasury;`

The treasury address is just passed down to the `SpaceCoinToken` contract, and is otherwise unused in the ICO contract. Thus it does not need to be a property on the ICO contract.

Consider: Removing line 17 to save on deployment gas costs.

## **[Q2]** Use immutables to save gas

On line 16, `SpaceCoinICO.sol` has the following code:

    `address public admin;`

On line 12, `SpaceCoinToken.sol` has the following code:

    ```
    address public admin;
    address public treasury;
    ```

These values never change throughout the lifecycle of both contracts.

Consider: Marking all 3 properties as `immutable`.

## **[Q3]** Use consts to save gas

On line 28, `SpaceCoinICO.sol` has the following code:

    `mapping(Status => uint256) public phaseContributionLimit;`

On line 70, `SpaceCoinICO.sol` has the following code:

    ```
    phaseContributionLimit[Status.SEED] = 15000 ether; // 15k
    phaseContributionLimit[Status.GENERAL] = 30000 ether; // 30k
    phaseContributionLimit[Status.OPEN] = 100000 ether; // 100k
    ```

These values spend more gas than necessary as they could be expressed as consts that would get compiled into the bytecode instead of occupying space on the EVM storage.

Consider: Replacing the mapping and the init logic with 3 constants initialized at compile time.

## **[Q4]** Use consts for code readability

On line 117, SpaceCoinICO.sol has the following code:

    ```
    function _getContributorLimit(
        address _contributor
    ) private view returns (uint256) {
        /// @dev if open, there is no limit for anyone until 100k eth
        if (phaseStatus == Status.OPEN) {
            /// @dev there are max 500k token & 5 token to 1 eth ICO ratio. 500k / 5 = 100k
            /// @dev => max possible by one contributor is 100k eth
            return 100000 ether;
        }

        if (phaseStatus == Status.GENERAL) {
            return 1000 ether;
        }

        /// @dev for whitelist peeps, 1500 eth is limit
        if (
            contributors[_contributor].isWhitelisted == true &&
            phaseStatus == Status.SEED
        ) {
            return 1500 ether;
        }

        return 0;
    }
    ```

These hardcoded values could be considered magic numbers, and it would be easier to replace them with const values without any additional cost. This is not a technical issue not a vulnerability, but a simple tweak to increase readability / maintainability.

Consider: Replacing the 3 hardcoded `ether` values with `consts`.

## **[Q5]** Long error messages

On line 75, `SpaceCoinICO.sol` has the following code:

    `require(msg.sender == admin, "SpaceCoinICO: ONLY_ADMIN");`

On line 82, `SpaceCoinICO.sol` has the following code:

    `require(isPaused == false, "SpaceCoinICO: CONTRACT_IS_PAUSED");`

On line 99, `SpaceCoinICO.sol` has the following code:

    ```
    require(
        uint256(_status) > uint256(phaseStatus),
        "SpaceCoinICO: CAN_ONLY_MOVE_FORWARD"
    );
    ```

On line 110, `SpaceCoinICO.sol` has the following code:

    `require(isPaused != _status, "SpaceCoinICO: INVALID_UPDATE");`

On line 173, `SpaceCoinICO.sol` has the following code:

    ```
    require(
        contributors[msg.sender].isWhitelisted == true,
        "SpaceCoinICO: NOT_ON_WHITELIST"
    );
    ```

On line 219, `SpaceCoinICO.sol` has the following code:

    ```
    require(phaseStatus == Status.OPEN, "SpaceCoinICO: ONLY_IN_OPEN_PHASE");

    require(_amount > 0, "SpaceCoinICO: ONLY_GREATER_THAN_0");
    ```

On line 23, `SpaceCoinToken.sol` has the following code:

    `require(msg.sender == admin, "SpaceCoinToken: ONLY_ADMIN");`

On line 75, `SpaceCoinToken.sol` has the following code:

    ```
    require(
        _amount + totalSupply() <= MINT_LIMIT,
        "SpaceCoinToken: MAX_TOKEN_LIMIT"
    );
    ```

All these error messages have a prefix that takes up extra space on the deployed bytecode.

Consider: Removing the prefixes to save up on the gas costs of deployment.

## [Q6] **Unneeded initializer**

On line 58, `SpaceCoinICO.sol` has the following code:

    `phaseStatus = Status.SEED;`

`Status.SEED` is the 0-value of the `Status` enum, therefore if left unset, a value of type `Status` will default to 0. When that's the case, you can save gas by skipping the initialization code.

Consider: Removing line 58

## [Q7] **Fat finger / Race condition guard**

On line 97, `SpaceCoinICO.sol` has the following code:

    ```
    function updatePhaseStatus(Status _status) external onlyAdmin {
        require(
            uint256(_status) > uint256(phaseStatus),
            "SpaceCoinICO: CAN_ONLY_MOVE_FORWARD"
        );

        phaseStatus = _status;
        emit PhaseStatusUpdated(_status, block.timestamp);
    }
    ```

This is of miniscule importance, but you can protect the contract owner against unwanted submissions / fat-fingering / race-conditions by having them submit their current understanding of the contract state, rather than their desired state, since the desired state can be computed from the submitted state.

## [Q8] **Private function**

On line 115, `SpaceCoinICO.sol` has the following code:

```
function _getContributorLimit(
        address _contributor
    ) private view returns (uint256) {
```

Marking a function as private should be a very purposeful act. Not wanting something to be public alone isn't ground for making something private. In that case, `internal` should suffice. Using `private` will be appropriate when in addition to the previous reason, you also never want a child contract to be able to change this underlying logic.

Consider: Marking the function as internal or public

## [Q9] **Redundant extension**

On line 27, `SpaceCoinToken.sol` has the following code:

    ```
    /// @notice transfer with an ability to tax 2% to treasury
    /// @dev relevant to 3f
    function transfer(address to, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        address owner = _msgSender();

        _safeTranfer(owner, to, amount);
        return true;
    }

    /// @notice transferFrom with an ability to tax 2% to treasury
    /// @dev relevant to 3f
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _safeTranfer(from, to, amount);
        return true;
    }
    ```

Since both of these functions internally call `_transfer`, you can override `_transfer` instead and be more DRY and gas efficient.

Consider: Extending `_transfer` instead.

## [Q10] **Modified but not-overriden behavior**

This is more of a warning than a code quality issue. Your token contract has modified the behavior of the public facing `transfer` and `transferFrom` functions. However, the future descendants of `SpaceCoinToken` will have access to the `_transfer` method that was initially exposed by the `ERC20` contract, since you haven't overriden it yourself. This means that there are now 2 ways your future descendants can do internal transfer logic, which may confuse them / lead them to shooting themselves in the leg.

## [Q11] **Block.timestamp in events **

Block.timestamp can be removed from the event payloads as the field can be derived / computed from other means.
