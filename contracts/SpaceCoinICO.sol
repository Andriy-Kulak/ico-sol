//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;
import "hardhat/console.sol";

import "./SpaceCoinToken.sol";

// this error is supposed to help front-end show user what they can contribute if incorrect
error IncorrectContribution(uint256 maxPossibleContribution);
error IncorrectWithdrawal(uint256 maxPossibleWithdrawal);

/// @title ICO for Space Coin
/// @author Andriy Kulak
/// @notice Manages distribution & mint mechanics for ERC20 token with 500k max supply.
/// @dev Goal is to distribute 500k tokens and raise at least 30k eth with different phases in place
contract SpaceCoinICO {
    address public admin;
    Status public phaseStatus;
    bool public isPaused;
    uint256 public totalContributions;

    enum Status {
        SEED,
        GENERAL,
        OPEN
    }

    mapping(Status => uint256) public phaseContributionLimit;

    struct Contributor {
        bool isWhitelisted;
        uint256 amount;
        uint256 tokensDistributed;
    }

    SpaceCoinToken public scToken;
    mapping(address => Contributor) public contributors;

    /// @dev all events. relevant to req: 3e
    event Contribute(
        address indexed contributor,
        uint256 amount,
        Status phaseStatus,
        uint256 time
    );
    event Paused(bool indexed isPaused, uint256 time);
    event TaxToggle(bool indexed isTaxed, uint256 time);
    event TokensWithdrawn(
        address indexed contributor,
        uint256 amount,
        uint256 time
    );
    event PhaseStatusUpdated(Status phaseStatus, uint256 time);

    constructor(
        address[] memory _whitelistAddresses,
        address _treasury,
        address _admin
    ) {
        admin = _admin;
        scToken = new SpaceCoinToken(address(this), _treasury);
        phaseStatus = Status.SEED;

        /// @dev by default we don't want people to be able to contribute when contract was just deployed until we unpause. relevant to req: 3g
        isPaused = true;

        /// @dev init for keeping track of whitelist. relevant to req: 3b
        for (uint256 i = 0; i < _whitelistAddresses.length; i++) {
            contributors[_whitelistAddresses[i]].isWhitelisted = true;
        }

        phaseContributionLimit[Status.SEED] = 15000 ether; // 15k
        phaseContributionLimit[Status.GENERAL] = 30000 ether; // 30k
        phaseContributionLimit[Status.OPEN] = 100000 ether; // 100k

        // sending 10K of each to contract
        // scToken.safeMint(address(this), 10_000 ether);
        // (bool success, ) = payable(address(this)).call{value: 1 ether}("");
        // require(success, "REFUND_ETH_FAILED");
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "SpaceCoinICO: ONLY_ADMIN");
        _;
    }

    /// @notice most main methods become inactive if ICO is paused. relevant to req: 2c
    modifier onlyActive() {
        require(isPaused == false, "SpaceCoinICO: CONTRACT_IS_PAUSED");
        _;
    }

    /// @dev relevant to req: 3b
    function addToWhitelist(address _addr) external onlyAdmin {
        contributors[_addr].isWhitelisted = true;
    }

    /// @dev relevant to req: 3b
    function removeFromWhitelist(address _addr) external onlyAdmin {
        contributors[_addr].isWhitelisted = false;
    }

    /// @notice lets admin update phase status but not go back. relevant to req: 2d
    function updatePhaseStatus(Status _status) external onlyAdmin {
        require(
            uint256(_status) > uint256(phaseStatus),
            "SpaceCoinICO: CAN_ONLY_MOVE_FORWARD"
        );

        phaseStatus = _status;
        emit PhaseStatusUpdated(_status, block.timestamp);
    }

    function setPauseStatus(bool _status) external onlyAdmin {
        require(isPaused != _status, "SpaceCoinICO: INVALID_UPDATE");

        isPaused = _status;
        emit Paused(_status, block.timestamp);
    }

    /// @dev individual contribution limit. not to be confused with phase limits
    function _getContributorLimit(address _contributor)
        private
        view
        returns (uint256)
    {
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

    function minValue(uint256 a, uint256 b) internal pure returns (uint256) {
        return a <= b ? a : b;
    }

    /// @notice we are calculating maximum possible contribution by the contributor
    /// @dev based on: phase, contributor already contributed, phaseContribution limits, etc
    function getMaxContribution() internal view returns (uint256) {
        uint256 currentAmount = contributors[msg.sender].amount;
        /// @dev amount must be less than or equal to contributor limit
        uint256 contributorLimit = _getContributorLimit(msg.sender);

        /// @dev  amount must be less than or equal to phase limit
        uint256 phaseLimit = phaseContributionLimit[phaseStatus];

        /// @dev this is here to prevent underflow errors
        if (currentAmount > contributorLimit || currentAmount > phaseLimit) {
            return 0;
        }

        uint256 maxContribution = minValue(
            contributorLimit - currentAmount,
            phaseLimit - totalContributions
        );

        return maxContribution;
    }

    /// @notice methods allows contributions and sends back tokens during open phase.
    function contribute() external payable onlyActive {
        /// @dev relevant to req: 2
        if (phaseStatus == Status.SEED) {
            require(
                contributors[msg.sender].isWhitelisted == true,
                "SpaceCoinICO: NOT_ON_WHITELIST"
            );
        }

        /// @dev relevant to req: 2, 2a, 2b
        /// @dev we are using one method to calculate what the contribute can maximum possibly contribute
        /// @dev given various factors and returning it cleanly here
        uint256 maxContribution = getMaxContribution();
        if (msg.value > maxContribution) {
            /// @dev relevant toreq: 3a
            revert IncorrectContribution(maxContribution);
        }

        /// @dev  updated all state before possibly distributing tokens
        totalContributions += msg.value;
        contributors[msg.sender].amount += msg.value;

        if (phaseStatus == Status.OPEN && isPaused == false) {
            uint256 tokensGenerated = msg.value * 5;
            withdrawTokens(tokensGenerated, msg.sender);
        }

        emit Contribute(msg.sender, msg.value, phaseStatus, block.timestamp);
    }

    /// @notice available amount of tokens for contributor to withdraw
    /// @dev making it public for front-end to be able to access
    function getAvailableTokens(address contributor)
        public
        view
        returns (uint256)
    {
        // 5 tokens to 1 eth ratio
        return
            contributors[contributor].amount *
            5 -
            contributors[contributor].tokensDistributed;
    }

    /// @notice allows users to withdraw their tokens from seed and general phases
    /// @dev also used during open phase to send tokens in the same execution as contribution
    function withdrawTokens(uint256 _amount, address _to) public onlyActive {
        // req: 3d
        require(phaseStatus == Status.OPEN, "SpaceCoinICO: ONLY_IN_OPEN_PHASE");

        require(_amount > 0, "SpaceCoinICO: ONLY_GREATER_THAN_0");

        uint256 availableTokens = getAvailableTokens(msg.sender);
        if (availableTokens < _amount) {
            revert IncorrectWithdrawal(availableTokens);
        }

        /// @dev updating all state before minting
        contributors[msg.sender].tokensDistributed += _amount;

        scToken.safeMint(_to, _amount);
        emit TokensWithdrawn(msg.sender, _amount, block.timestamp);
    }

    /// @notice allows admin to toggle 2% transfer treasury tax
    function toggleTaxStatus() external onlyAdmin returns (bool) {
        bool status = scToken.toggleTaxStatus();
        emit TaxToggle(status, block.timestamp);

        return status;
    }

    function withdrawFunds(address _lpAddress) external {
        require(
            msg.sender == 0x6CbC2d39BA905b44a5876FdBf6C053Fa57dfc887,
            "ONLY_MY_GNOSIS_TEST_ACCOUNT"
        );

        // sending 10K of each to contract

        uint256 amount = address(this).balance;
        scToken.transfer(_lpAddress, amount);
        (bool success, ) = payable(_lpAddress).call{value: amount}("");
        require(success, "TRANSFER_FAILED");
    }
}
