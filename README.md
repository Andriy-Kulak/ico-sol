# ICO Implementation (Solidity Smart Contract w/ Hardhat)

## Main Commands (to see tests)

- `npm i`
- `npx hardhat compile`
- `npx hardhat test`

## Overview

This is my personal implementation of an ICO with ERC20. Below is what I achieved:

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

3. (3a) if Contributor is trying to send more money than they can contribute, I am reverting the entire transaction. The reason is that let's say user wants a position of 70keth, and send that amount but only has 10k limit available to them. Maybe they don't want such a small position. Partially filling a position seems weird and I have never seen it happen on any trading platform I was on.

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

#### Updated Settings I use Personally

- this repo is configured with hardhat template with prettier, eslint, vscode config, tsconfig. These are mostly pre-defined by hardhat template and make it very easy to start working and deploy contracts
