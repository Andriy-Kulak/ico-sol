
Commit: https://github.com/0xMacro/student.Andriy-Kulak/tree/b11292675a3c8756469e8dd476eebd5195416140/ico

Audited By: chaboo

Reachable via discord: chaboo#1291

# General Comments

Clean, readable and mostly correct code. Great test suite and code coverage.
Contracts deployed and functional frontend provided.

Overall: Good job!

# Design Exercise

I agree with your general approach, of course devil is in the details,
and for us smart contract engineers that would be in the implementation :)

# Issues

### **[Technical Mistake 1]**  Using storage variable for constants

You have mapping storage variable `phaseContributionLimit` which are 3 constants.
Whenever this mapping is accessed it results in unnecessary SLOAD. In a blockchain
environment runtime performance and associated cost of execution takes more priority
than API convenience.

### **[Technical Mistake 2]** Open phase limit is same as for General phase 30k ether

ICO goal is 30k ether not 100k ether. 500k is the number of SPC in existence. However, 150k SPC (30k ETH * 5) is the amount to sell in the ICO. It's like when Coinbase does their IPO, they may have 500k shares in total, but in this initial public offering they are only going to sell 150k of them. You only want to sell a portion of the total shares in the ICO, because then you'll have more to sell in the future.

### **[Extra Feature]** Toggle tax status should not be present on SpaceICO contract

Remove toggleTaxStatus from SpaceICO contract since that is not part of spec for SpaceCoinICO but rather SpaceCoinToken.

### **[Extra Feature]** Removing seed investors

This feature raises the possibility of someone being a seed investor, making a seed investment, and then being removed from the seed investor list. They would then not be able to make further seed investments, but they would still be a seed investor, whereas for others checking `contributors[addr].isWhitelisted` they are not. In smart contracts every extra feature, and every extra line of code, increases your exposure to risk. Always keep things as simple as possible.

### [Q-1] Unnecessary overrides in SpaceCoin.sol

All the overrides could be replaced with following method which calls super to perform
standard _transfer behaviour.

```
  function _transfer(address from, address to, uint256 amount) internal virtual override {
    if (isTaxable) {
      uint256 amountToTreasury = (amount * 2) / 100;
      uint256 amountToTransfer = amount - amountToTreasury;

      super._transfer(from, treasury, amountToTreasury);
      super._transfer(from, to, amountToTransfer);
    } else {
      super._transfer(from, to, amount);
    }
  }
```

### [Q-2] Consider adding an event when Whitelist is updated

Events emitted when whitelist is update can be helpful for off chain monitoring
and detecting potentially suspicious behaviour.

### [Q-3] Unnecessary expression in condition

```
if (phaseStatus == Status.OPEN && isPaused == false) {
```

`isPaused == false` part here is unnecessary since onlyActive modifier for this method
gurantees that isPaused is false.

### [Q-4] Use constant for SPC/ETH conversion ratio in SpaceICO.sol

In multiple places literal value 5 is used. Consider replacing it with constant value.

### [Q-5] Consider reordering event emission in contribute method

Following is excerpt of code from contribute method.

```
if (phaseStatus == Status.OPEN && isPaused == false) {
    uint256 tokensGenerated = msg.value * 5;
    withdrawTokens(tokensGenerated, msg.sender);
}

emit Contribute(msg.sender, msg.value, phaseStatus, block.timestamp);
```

withdrawTokens method will emit following event
```
emit TokensWithdrawn(msg.sender, _amount, block.timestamp);
```

which results in TokensWithdrawn event being before Contribute event.

Update contribute method to have following emit event ordering:

```
emit Contribute(msg.sender, msg.value, phaseStatus, block.timestamp);

if (phaseStatus == Status.OPEN && isPaused == false) {
    uint256 tokensGenerated = msg.value * 5;
    withdrawTokens(tokensGenerated, msg.sender);
}
```

### [Q-7] User can execute contribute with 0 amount

There is no check that `msg.value > 0` in the `contribute` function. This means
that Contribute event can be emitted for Seed and General phases even though
contributor hasn't contributed any ETH.

Consider checking to ensure users contribute a minimum amount of ETH to
be successfully processed.

### **[Q-8]** Adding whitelisted addresses 1 by 1 is gas inefficient

Each Ethereum transaction has an initial fixed cost of 21_000 gas, which
is in addition to the cost of executing computation and storing variables
in the contract. By only allowing a single whitelisted address to be added
per function call, this is going to waste a lot of gas compared to a function
which takes in an array of whitelisted addresses and adds them in a single
transaction.

Consider accepting and processing array of addresses to whitelist.


# Nitpicks

1. Remove hardhat/console.sol import from your production ready code.
2. Some other more readable ways to write same.
```
MINT_LIMIT = 500 * 1000 * 10**18;
// consider
MINT_LIMIT = 500_000e18;
MINT_LIMIT = 500_000 * 10**18;
MINT_LIMIT = 500_000 ether;
```
3. boolean variables do not need to be compared with bool literal
```
if(isTaxable == true)
// consider replacing with
if (isTaxable)
```
there are multiple other places with the same issue.

4. Be consistent in use of custom errors or revert expressions with string error messages

In contribute method you have both forms of error generation.

# Score
| Reason | Score |
|-|-|
| Late                       | - |
| Unfinished features        | - |
| Extra features             | 2 |
| Vulnerability              | - |
| Unanswered design exercise | - |
| Insufficient tests         | - |
| Technical mistake          | 2 |

Total: 4

Good job!