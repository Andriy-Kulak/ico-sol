# Advanced Sample Hardhat Project

This project demonstrates an advanced Hardhat use case, integrating other tools commonly used alongside Hardhat in the ecosystem.

The project comes with a sample contract, a test for that contract, a sample script that deploys that contract, and an example of a task implementation, which simply lists the available accounts. It also comes with a variety of other tools, preconfigured to work with the project code.

Try running some of the following tasks:

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
npx hardhat help
REPORT_GAS=true npx hardhat test
npx hardhat coverage
npx hardhat run scripts/deploy.ts
TS_NODE_FILES=true npx ts-node scripts/deploy.ts
npx eslint '**/*.{js,ts}'
npx eslint '**/*.{js,ts}' --fix
npx prettier '**/*.{json,sol,md}' --check
npx prettier '**/*.{json,sol,md}' --write
npx solhint 'contracts/**/*.sol'
npx solhint 'contracts/**/*.sol' --fix
```

# Etherscan verification

To try out Etherscan verification, you first need to deploy a contract to an Ethereum network that's supported by Etherscan, such as Ropsten.

In this project, copy the .env.example file to a file named .env, and then edit it to fill in the details. Enter your Etherscan API key, your Ropsten node URL (eg from Alchemy), and the private key of the account which will send the deployment transaction. With a valid .env file in place, first deploy your contract:

```shell
hardhat run --network ropsten scripts/deploy.ts
```

Then, copy the deployment address and paste it in to replace `DEPLOYED_CONTRACT_ADDRESS` in this command:

```shell
npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS "Hello, Hardhat!"
```

# Performance optimizations

For faster runs of your tests and scripts, consider skipping ts-node's type checking by setting the environment variable `TS_NODE_TRANSPILE_ONLY` to `1` in hardhat's environment. For more details see [the documentation](https://hardhat.org/guides/typescript.html#performance-optimizations).x

### Notes for Self (Andriy)

additional things that I add for myself

1. .vscode settings
2. update eslint settings
3. `npm i --save @openzeppelin/contracts`
4. in solidity files, I can add `import "hardhat/console.sol";` and then use `console.log` like in javascript to test
5. add `nodemon` and autorun `nodemon -x 'npx hardhat test' -w contracts -w test -e js,ts,sol`

# ICO Assignment Details

### Requirements

1. Create an ERC20 Contract

- (1a) 500,000 max total supply
- (1b) A 2% tax on every transfer that gets put into a treasury account
- (1c) A flag that toggles this tax on/off, controllable by owner, initialized to false
- (1d) The smart contract aims to raise 30,000 Ether by performing an ICO.

2. The ICO should only be available to whitelisted private investors starting in Phase Seed with a maximum total private contribution limit of 15,000 Ether and an individual contribution limit of 1,500 Ether.

- (2a) The ICO should become available to the general public during Phase General, with a total contribution limit equal to 30,000 Ether, inclusive of funds raised from the private phase.
- (2b) During this phase, the individual contribution limit should be 1,000 Ether, until Phase Open, at which point the individual contribution limit should be removed. At that point, the ICO contract should immediately release ERC20-compatible tokens for all contributors at an exchange rate of 5 tokens to 1 Ether.
- (2c) The owner of the contract should have the ability to pause and resume fundraising at any time,
- (2d) as well as move a phase forwards (but not backwards) at will.

### Derived Requirements

3.

- (3a) if Contributor is trying to send more money than they can contribute, I am reverting the entire transaction. The reason is that let's say user wants a position of 70keth, and send that amount but only has 10k limit available to them. Maybe they don't want such a small position. Partially filling a position seems weird and I have never seen it happen on any trading platform I was on.
- (3b) for whitelist, you can instantiate them during contract creation as well as add & remove using contract functions
- (3d) if contract is paused, contributors cannot withdraw tokens
- (3e) ensure events are being emitted on main methods
- (3f) in Token Contract, I overwrote tranfer and transferFrom so we can easily toggle tax deduction to treasury
- (3g) contract by default is paused upon instatiation so that people cannot contribute until admin decides so
- ensure 95% test coverage or better
- for taxing of tokens, I only implemented in when there is a `transfer` or `transferFrom`. Some people mentioned they thought about taxing during withdrawal but I thought that it didn't make sense
- ICO Contract technically cannot withdraw funds contributed but this is not part of the assignment

#### ICO Phases

- `Phase Seed` - only for whitelisted. limit 1.5k eth. total limit 15k.
- `Phase General` - any user can contribute. limit 1k eth. total limit 30k
- `Phase Open` - any user can claim. no limit up to 50k tokens.
  - during this phase, contributors can withdraw their tokens
  - also if they contribute, they get tokens sent to them automatically
  - fractional contributions are OK

#### Things I Implemented from last staff audit

- I tried to make it easier to understand what state the contract is in
  - for instance `getMaxContribution(...)` calculates what is the max possible contribution a contrinbutor can make given variables like phaseStatus, phaseLimit, individual past contributions, etc. This keeps the `contribute()` method clean in what otherwise could have been very messy logic
- also starting using custom errors to show user that if they incorrectly contribute or withdraw, what is the actual amount they can request
- tried using more modifiers to catch any edge cases
- added Natspec documentation
- making proper use of external functions
- using common error standards
- tested using `slither .`. I did not find any major vulnerabilities

#### Design Exercise

The base requirements give contributors their SPC tokens immediately. How would you design your contract to vest the awarded tokens instead, i.e. award tokens to users over time, linearly?

1. Simple Version

- I would only start awarding tokens at the Open Stage and at some point user will not be able to contribute anymore (I would probably add addition state to add a lockup period)
- once we get to this stage, we can distribute for instance 10% of their contribution periodically. And the user would have to withdraw these tokens themselves and would not be able to contribute during lockup period
- this would have benefits of keeping state simple, but may create an inconvenience (for instance lock up period)

2. Complex Version

- Same as the simple version but without the lockup period. We would keep track of each contribution separately and distribute proportional amount (like 10%) of each contribution after it was made.
- I would have to do more digging for this scenario, but it would potentially make state a lot more complex and increase gas costs
- Upside is that it would allow contributors to keep contributing without a lockup period and get distributions in a more dynamic fashion

### Deployed contract:

- my deploy script: `npx hardhat run --network goerli scripts/deploy.ts --show-stack-traces`
- I am using goreli
- ICO contract address: `0xB51685aEA76e250da73e17eD42268990DAC03c32`
- ERC20 address: `0x65cecC15180a8Cd454c977f581954e836bb49157`
  - you can also get this by doing `await contract.connect(signer).scToken()` on front-end

### For Frontend

I used create-react-app scaffold

To Get Started

- `cd frontend`
- `npm ci`
- `npm start` => this should open up localhost:3000

#### UI Steps

1. Sign in With Metamask
2. Contribute an amount (I set 0.01 by default)
3. Check on etherscan contrbution
4. After contribution is successsful, you can click: `Check Personal Token Balance`

#### Things I did not have time for:

- making front-end pretty
- improving ui so when transaction is complete, I could have listened to that event and update token balance automatically
- \*\*\* if you start switching different to different metamask accounts, you may have to clear cache/local storage. I didn't have time to make the sign in process bullet proof

#### Front End Examples

- I added screenshots at the bottom of app so you can see what it's supposed to look like
- example of contribition: https://goerli.etherscan.io/tx/0x59db4309882b29343568df77dc704838b150f40d4f0f791feb93298e2a7cd73a
