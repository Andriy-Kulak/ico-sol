import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  SpaceCoinToken,
  SpaceCoinToken__factory,
  SpaceCoinICO,
  SpaceCoinICO__factory,
} from "../typechain";

enum Status {
  SEED,
  GENERAL,
  OPEN,
  FAKE_STATUS,
}

const errors = {
  nonAdmin: "SpaceCoinICO: ONLY_ADMIN",
  nonWhitelist: "SpaceCoinICO: NOT_ON_WHITELIST",
  onlyActive: "SpaceCoinICO: CONTRACT_IS_PAUSED",
  withdrawOnlyOpen: "SpaceCoinICO: ONLY_IN_OPEN_PHASE",
  tokenNonAdmin: "SpaceCoinToken: ONLY_ADMIN",
  pauseOnceError: "SpaceCoinICO: INVALID_UPDATE",
  tokenLimit: "SpaceCoinToken: MAX_TOKEN_LIMIT",
  onlyForward: "SpaceCoinICO: CAN_ONLY_MOVE_FORWARD",
  greaterThan0: "SpaceCoinICO: ONLY_GREATER_THAN_0",
};

const ONE_ETH: BigNumber = ethers.utils.parseEther("1");
const FOUR_ETH: BigNumber = ethers.utils.parseEther("4");
const FIVE_ETH: BigNumber = ethers.utils.parseEther("5");
const TWENTY_ETH: BigNumber = ethers.utils.parseEther("20");
const TWENTY_FIVE_ETH: BigNumber = ethers.utils.parseEther("25");
const HUNDRED_TWENTY_ETH: BigNumber = ethers.utils.parseEther("120");
const HUNDRED_TWENTY_FIVE_ETH: BigNumber = ethers.utils.parseEther("125");
const HUNDRED_FIFTY_ETH: BigNumber = ethers.utils.parseEther("150");
const HUNDRED_K_ETH: BigNumber = ethers.utils.parseEther("100000");
const FIVE_HUNDRED_K_ETH: BigNumber = ethers.utils.parseEther("500000");

describe("Space Coin Token", function () {
  // all the addresses
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let chrisWL: SignerWithAddress;
  let julieWL: SignerWithAddress;
  let junWL: SignerWithAddress;
  let treasuryAddr: SignerWithAddress;

  let SpaceCoinTokenFactory: SpaceCoinToken__factory;
  let spaceCoinToken: SpaceCoinToken;
  let SpaceCoinICOFactory: SpaceCoinICO__factory;
  let spaceCoinICO: SpaceCoinICO;

  const deploySoloERC20 = async () => {
    SpaceCoinTokenFactory = await ethers.getContractFactory("SpaceCoinToken");
    spaceCoinToken = (await SpaceCoinTokenFactory.deploy(
      deployer.address,
      treasuryAddr.address
    )) as SpaceCoinToken;
    await spaceCoinToken.deployed();
  };

  describe("Space Coin ICO Tests", () => {
    this.beforeEach(async () => {
      [deployer, alice, bob, chrisWL, julieWL, junWL, treasuryAddr] =
        await ethers.getSigners();
      SpaceCoinICOFactory = await ethers.getContractFactory("SpaceCoinICO");
      spaceCoinICO = (await SpaceCoinICOFactory.deploy(
        [chrisWL.address, julieWL.address],
        treasuryAddr.address
      )) as SpaceCoinICO;
      await spaceCoinICO.deployed();

      const coinAddress = await spaceCoinICO.scToken();

      // used to interact with token contract so we can confirm balances and test it for security
      spaceCoinToken = await ethers.getContractAt(
        "SpaceCoinToken",
        coinAddress
      );
    });

    describe("Basic ICO Access and State Checks", () => {
      it("contract is paused by default", async () => {
        expect(await spaceCoinICO.isPaused()).to.eq(true);
      });

      it("can update pause status false", async () => {
        await spaceCoinICO.setPauseStatus(false);
        expect(await spaceCoinICO.isPaused()).to.eq(false);
      });

      it("cannot update pause status to false twice", async () => {
        await spaceCoinICO.setPauseStatus(false);

        await expect(spaceCoinICO.setPauseStatus(false)).to.be.revertedWith(
          errors.pauseOnceError
        );
      });

      it("should make sure token & whitelist is instantiated", async () => {
        expect(await spaceCoinICO.scToken()).to.exist;

        const chrisState = await spaceCoinICO.contributors(chrisWL.address);
        expect(chrisState.isWhitelisted).to.eq(true);

        const julieState = await spaceCoinICO.contributors(julieWL.address);
        expect(julieState.isWhitelisted).to.eq(true);
      });

      it("can add and remove people to whitelist", async () => {
        // added to WL
        await spaceCoinICO.addToWhitelist(junWL.address);

        const junState = await spaceCoinICO.contributors(junWL.address);
        expect(junState.isWhitelisted).to.eq(true);

        // removed (set to false)
        await spaceCoinICO.removeFromWhitelist(junWL.address);

        const junState2 = await spaceCoinICO.contributors(junWL.address);
        expect(junState2.isWhitelisted).to.eq(false);
      });

      it("non-admins cannot add & remove from whitelist", async () => {
        await expect(
          spaceCoinICO.connect(junWL).addToWhitelist(junWL.address)
        ).to.be.revertedWith(errors.nonAdmin);

        await expect(
          spaceCoinICO.connect(junWL).removeFromWhitelist(junWL.address)
        ).to.be.revertedWith(errors.nonAdmin);
      });

      it("initial status isPaused=true, phaseStatus=SEED, and can be updated to false & OPEN/GENERAL respectively", async () => {
        expect(await spaceCoinICO.isPaused()).to.eq(true);
        expect(await spaceCoinICO.phaseStatus()).to.eq(Status.SEED);

        await spaceCoinICO.updatePhaseStatus(Status.GENERAL); // going forward
        expect(await spaceCoinICO.phaseStatus()).to.eq(Status.GENERAL);

        await spaceCoinICO.updatePhaseStatus(Status.OPEN); // going forward
        expect(await spaceCoinICO.phaseStatus()).to.eq(Status.OPEN);

        await spaceCoinICO.setPauseStatus(false);
        expect(await spaceCoinICO.isPaused()).to.eq(false);
      });

      it("phase Statuses cannot go back or stay the same", async () => {
        // currently in SEED so cannot update to SEED
        await expect(
          spaceCoinICO.updatePhaseStatus(Status.SEED)
        ).to.be.revertedWith(errors.onlyForward);

        await spaceCoinICO.updatePhaseStatus(Status.GENERAL); // going forward
        // cannot go back
        await expect(
          spaceCoinICO.updatePhaseStatus(Status.SEED)
        ).to.be.revertedWith(errors.onlyForward);

        await spaceCoinICO.updatePhaseStatus(Status.OPEN); // going forward
        // cannot go back
        await expect(
          spaceCoinICO.updatePhaseStatus(Status.GENERAL)
        ).to.be.revertedWith(errors.onlyForward);
      });

      it("try and fail to set phaseStatus to non-existent", async () => {
        await expect(
          spaceCoinICO.updatePhaseStatus(Status.FAKE_STATUS)
        ).to.be.revertedWith(
          "Transaction reverted: function was called with incorrect parameters"
        );
      });

      it("non-admins cannot update phase state", async () => {
        await expect(
          spaceCoinICO.connect(julieWL).updatePhaseStatus(Status.OPEN)
        ).to.be.revertedWith(errors.nonAdmin);
      });

      it("treasury address is set", async () => {
        expect(await spaceCoinICO.treasury()).to.eq(treasuryAddr.address);
      });
    });

    describe("Contribution Scenarios", () => {
      it("only can contribute when contract isPaused=false", async () => {
        expect(await spaceCoinICO.isPaused()).to.eq(true);

        await expect(
          spaceCoinICO.contribute({ value: ONE_ETH })
        ).to.be.revertedWith(errors.onlyActive);
      });

      it("whitelisted user can make a basic contribution in isPaused=false, phaseStatus=SEED", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        // julie is WL
        await spaceCoinICO.connect(julieWL).contribute({ value: ONE_ETH });

        const julieState = await spaceCoinICO.contributors(julieWL.address);
        expect(julieState.amount).to.eq(ONE_ETH);

        expect(await spaceCoinICO.totalContributions()).to.eq(ONE_ETH);
      });

      it("whitelisted user cannot make a contribution after un-white listed in isPaused=false, phaseStatus=SEED", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        // julie is WL
        await spaceCoinICO.connect(julieWL).contribute({ value: ONE_ETH });

        const julieState = await spaceCoinICO.contributors(julieWL.address);
        expect(julieState.amount).to.eq(ONE_ETH);

        expect(await spaceCoinICO.totalContributions()).to.eq(ONE_ETH);

        await spaceCoinICO.removeFromWhitelist(julieWL.address);

        await expect(
          spaceCoinICO.connect(julieWL).contribute({ value: ONE_ETH })
        ).to.be.revertedWith(errors.nonWhitelist);
      });

      it("whitelisted user cannot make contibution > 1.5K in isPaused=false, phaseStatus=SEED", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        // julie is WL
        await expect(
          spaceCoinICO
            .connect(julieWL)
            .contribute({ value: ethers.utils.parseEther("1501") })
        ).to.be.revertedWith("IncorrectContribution(1500000000000000000000)");
      });

      it("WL User cannot exceed personal limit in isPaused=false, phaseStatus=SEED", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        await expect(
          spaceCoinICO
            .connect(julieWL)
            .contribute({ value: ethers.utils.parseEther("1501") })
        ).to.revertedWith("IncorrectContribution(1500000000000000000000)");
      });

      it("WL User get accurate contribution error of 0 eth isPaused=false, phaseStatus=SEED", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        await spaceCoinICO
          .connect(julieWL)
          .contribute({ value: ethers.utils.parseEther("1400") });

        await spaceCoinICO
          .connect(julieWL)
          .contribute({ value: ethers.utils.parseEther("100") }); // should be correct. contribute 1.5k eth

        await expect(
          spaceCoinICO
            .connect(julieWL)
            .contribute({ value: ethers.utils.parseEther("1") })
        ).to.revertedWith("IncorrectContribution(0)"); // 0 eth. you maxed out contribution
      });

      it("Multiple WL User can contribute twice in isPaused=false, phaseStatus=SEED", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        await spaceCoinICO.connect(julieWL).contribute({ value: ONE_ETH });

        await spaceCoinICO.connect(julieWL).contribute({ value: FOUR_ETH });

        await spaceCoinICO
          .connect(chrisWL)
          .contribute({ value: ethers.utils.parseEther("3.3") });

        const julieState = await spaceCoinICO.contributors(julieWL.address);
        expect(julieState.amount).to.eq(FIVE_ETH);

        const chrisState = await spaceCoinICO.contributors(chrisWL.address);
        expect(chrisState.amount).to.eq(ethers.utils.parseEther("3.3"));

        expect(await spaceCoinICO.totalContributions()).to.eq(
          ethers.utils.parseEther("8.3")
        );
      });
      // ensure non-WL cannot contribute during SEED phase
      it("non-WL user cannot contribute in isPaused=false, phaseStatus=SEED", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        await expect(
          spaceCoinICO.connect(bob).contribute({ value: ONE_ETH })
        ).to.revertedWith(errors.nonWhitelist);
      });
      // ensuring any user cannot exceed personal limit in GENERAL PHASE
      it("user cannot exceed personal limit in isPaused=false, phaseStatus=GENERAL", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing
        await spaceCoinICO.updatePhaseStatus(Status.GENERAL);

        await expect(
          spaceCoinICO
            .connect(bob)
            .contribute({ value: ethers.utils.parseEther("1001") })
        ).to.revertedWith("IncorrectContribution(1000000000000000000000)");
      });

      // ensuring general non WL user gets correct error ones they max out their contribution

      it("non-WL User get accurate contribution error of 0 eth isPaused=false, phaseStatus=GENERAL", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing
        await spaceCoinICO.updatePhaseStatus(Status.GENERAL);

        await spaceCoinICO
          .connect(bob)
          .contribute({ value: ethers.utils.parseEther("900") });

        await spaceCoinICO
          .connect(bob)
          .contribute({ value: ethers.utils.parseEther("100") }); // should be correct. contribute 1.5k eth

        await expect(
          spaceCoinICO
            .connect(bob)
            .contribute({ value: ethers.utils.parseEther("1") })
        ).to.revertedWith("IncorrectContribution(0)"); // 0 eth. you maxed out contribution
      });

      // making sure WL user can contribute in SEED PHASE, then status GETS to General Phase, they cannot contribute
      it("WL User adds 1.4k in phaseStatus=SEED, cannot add more in phaseStatus=GENERAL", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        await spaceCoinICO
          .connect(julieWL)
          .contribute({ value: ethers.utils.parseEther("1400") });

        await spaceCoinICO.updatePhaseStatus(Status.GENERAL);

        // making sure after we switch to general, julie still has contributed 1.4k eth
        const julieState = await spaceCoinICO.contributors(julieWL.address);
        expect(julieState.amount).to.eq(ethers.utils.parseEther("1400"));

        // julie should not be able to contribute more than the 1k in general phase
        await expect(
          spaceCoinICO.connect(julieWL).contribute({ value: ONE_ETH })
        ).to.be.revertedWith("IncorrectContribution(0)");
      });

      // ensure correct errors are provided when phaseState=GENERAL is maxed out & WL and regular people cannot contribute more
      it("regular User adds 800eth. then trying to add 201eth gets error phaseStatus=GENERAL", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing
        await spaceCoinICO.updatePhaseStatus(Status.GENERAL);

        // julie should not be able to contribute more than the 1k in general phase
        await spaceCoinICO
          .connect(julieWL)
          .contribute({ value: ethers.utils.parseEther("800") });

        await expect(
          spaceCoinICO
            .connect(julieWL)
            .contribute({ value: ethers.utils.parseEther("201") })
        ).to.be.revertedWith("IncorrectContribution(200000000000000000000)"); // can only contribute 200eth more.
      });

      it("WL user maxed out seed phase, can contribute more in open phase", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        await spaceCoinICO
          .connect(julieWL)
          .contribute({ value: ethers.utils.parseEther("1500") });

        await spaceCoinICO.updatePhaseStatus(Status.OPEN);

        // making sure after we switch to general, julie still has contributed 1.4k eth
        const julieState = await spaceCoinICO.contributors(julieWL.address);
        expect(julieState.amount).to.eq(ethers.utils.parseEther("1500"));

        // julie should not be able to contribute more than the 1k in general phase

        await spaceCoinICO
          .connect(julieWL)
          .contribute({ value: ethers.utils.parseEther("300") });

        // julie should have 1800 eth contributed now
        const julieState2 = await spaceCoinICO.contributors(julieWL.address);
        expect(julieState2.amount).to.eq(ethers.utils.parseEther("1800"));
      });

      it("non-WL user max out general phase, can contirbute more in open phase", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing
        await spaceCoinICO.updatePhaseStatus(Status.GENERAL);

        await spaceCoinICO
          .connect(bob)
          .contribute({ value: ethers.utils.parseEther("1000") });

        await spaceCoinICO.updatePhaseStatus(Status.OPEN);

        // making sure after we switch to general, julie still has contributed 1.4k eth
        const bobState = await spaceCoinICO.contributors(bob.address);
        expect(bobState.amount).to.eq(ethers.utils.parseEther("1000"));

        // bob should be able to contribute more in open phase
        await spaceCoinICO
          .connect(bob)
          .contribute({ value: ethers.utils.parseEther("300") });

        // bob should have 1300 eth contributed now
        const bobStateState2 = await spaceCoinICO.contributors(bob.address);
        expect(bobStateState2.amount).to.eq(ethers.utils.parseEther("1300"));
      });
    });

    describe("Phase & Token Limit Edge Cases", () => {
      const setUp = async (count: number, amount: BigNumber, isWL: boolean) => {
        await spaceCoinICO.setPauseStatus(false);

        const accounts = await ethers.getSigners();
        for (let i = 0; i < count; i++) {
          const { address } = accounts[i];
          if (isWL === true) {
            spaceCoinICO.addToWhitelist(address);
          }

          await spaceCoinICO.connect(accounts[i]).contribute({ value: amount });
        }
      };

      it("Open Phase cannot contribute more than 100k eth total", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing
        await spaceCoinICO.updatePhaseStatus(Status.OPEN);

        await spaceCoinICO.connect(bob).contribute({ value: HUNDRED_K_ETH }); // this is the max

        await expect(
          spaceCoinICO.connect(bob).contribute({ value: ONE_ETH })
        ).to.be.revertedWith("IncorrectContribution(0)"); // should reject
      });

      it("Seed Phase cannot go above 15k limit", async () => {
        const maxSeedIndividualAmount: BigNumber =
          ethers.utils.parseEther("1500");

        // we got all the way to 15k here
        await setUp(10, maxSeedIndividualAmount, true);

        await expect(
          spaceCoinICO.connect(bob).contribute({ value: ONE_ETH })
        ).to.be.revertedWith("IncorrectContribution(0)");
      });

      it("General Phase cannot go above 30k limit", async () => {
        await spaceCoinICO.updatePhaseStatus(Status.GENERAL);
        const maxSeedIndividualAmount: BigNumber =
          ethers.utils.parseEther("1000");

        // we got all the way to 30k here
        await setUp(30, maxSeedIndividualAmount, false);

        await expect(
          spaceCoinICO.connect(bob).contribute({ value: ONE_ETH })
        ).to.be.revertedWith("IncorrectContribution(0)");
      });
    });

    describe("Distribution Scenarios", () => {
      it("cannot withdraw in SEED or GENERAL PHASE", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        // julie contributes 25 eth
        await spaceCoinICO
          .connect(julieWL)
          .contribute({ value: TWENTY_FIVE_ETH });

        await expect(
          spaceCoinICO
            .connect(julieWL)
            .withdrawTokens(HUNDRED_TWENTY_ETH, julieWL.address)
        ).to.be.revertedWith(errors.withdrawOnlyOpen); // cannot withdraw in SEED phase

        await spaceCoinICO.updatePhaseStatus(Status.GENERAL);
        await expect(
          spaceCoinICO
            .connect(julieWL)
            .withdrawTokens(HUNDRED_TWENTY_ETH, julieWL.address)
        ).to.be.revertedWith(errors.withdrawOnlyOpen); // cannot withdraw in GENERAL phase
      });

      it("cannot withdraw amount=0", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        // julie contributes 25 eth
        await spaceCoinICO
          .connect(julieWL)
          .contribute({ value: TWENTY_FIVE_ETH });

        await spaceCoinICO.updatePhaseStatus(Status.OPEN);
        await expect(
          spaceCoinICO.connect(julieWL).withdrawTokens(0, julieWL.address)
        ).to.be.revertedWith(errors.greaterThan0); // cannot withdraw amount=0
      });

      it("simple withdrawal to 2 addresses for one user in isPaused=false, phaseStatus=OPEN", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        // julie contributes 25 eth
        await spaceCoinICO
          .connect(julieWL)
          .contribute({ value: TWENTY_FIVE_ETH });

        await spaceCoinICO.updatePhaseStatus(Status.OPEN); // going forward so user can withdraw

        // withdraw all 125 tokens. 120 to Julie and 5 to bob
        await spaceCoinICO
          .connect(julieWL)
          .withdrawTokens(HUNDRED_TWENTY_ETH, julieWL.address);

        await spaceCoinICO
          .connect(julieWL)
          .withdrawTokens(FIVE_ETH, bob.address);

        const bobBalance = await spaceCoinToken.balanceOf(bob.address);
        const julieBalance = await spaceCoinToken.balanceOf(julieWL.address);

        expect(bobBalance).to.eq(FIVE_ETH);
        expect(julieBalance).to.eq(HUNDRED_TWENTY_ETH);

        // ensuring that token state in ico is correct
        const julieState = await spaceCoinICO.contributors(julieWL.address);
        const bobState = await spaceCoinICO.contributors(bob.address);

        expect(bobState.tokensDistributed).to.eq(0);
        expect(julieState.tokensDistributed).to.eq(HUNDRED_TWENTY_FIVE_ETH);
      });

      it("fractional withdrawal to 2 addresses for one user in isPaused=false, phaseStatus=OPEN", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        // julie contributes 1.x eth
        await spaceCoinICO
          .connect(julieWL)
          .contribute({ value: ethers.utils.parseEther("1.39882") }); // *5 = 6.9941

        await spaceCoinICO.updatePhaseStatus(Status.OPEN); // going forward so user can withdraw

        // bob contributes 1.x eth
        await spaceCoinICO
          .connect(bob)
          .contribute({ value: ethers.utils.parseEther("2.900003") }); // *5 = 14.500015

        await spaceCoinICO
          .connect(julieWL)
          .withdrawTokens(ethers.utils.parseEther("6.9941"), julieWL.address);

        // ensuring that token state in ico is correct
        const julieState = await spaceCoinICO.contributors(julieWL.address);
        const bobState = await spaceCoinICO.contributors(bob.address);

        expect(julieState.tokensDistributed).to.eq(
          ethers.utils.parseEther("6.9941")
        );

        // bob should already have withdrawn automatically when he contributed during open phase
        expect(bobState.tokensDistributed).to.eq(
          ethers.utils.parseEther("14.500015")
        );

        const julieBalance = await spaceCoinToken.balanceOf(julieWL.address);
        const bobBalance = await spaceCoinToken.balanceOf(bob.address);

        expect(julieBalance).to.eq(ethers.utils.parseEther("6.9941"));
        expect(bobBalance).to.eq(ethers.utils.parseEther("14.500015"));
      });

      it("user tries to withdraw too much addresses for one user in isPaused=false, phaseStatus=OPEN", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        // julie contributes 5 eth
        await spaceCoinICO.connect(julieWL).contribute({ value: FIVE_ETH });

        await spaceCoinICO.updatePhaseStatus(Status.OPEN); // going forward so user can withdraw

        // withdraw all 25 tokens.
        await spaceCoinICO
          .connect(julieWL)
          .withdrawTokens(TWENTY_ETH, julieWL.address);

        const julieBalance = await spaceCoinToken.balanceOf(julieWL.address);
        expect(julieBalance).to.eq(TWENTY_ETH);

        // tries to withdraw 20 tokens. only 5 are available
        await expect(
          spaceCoinICO
            .connect(julieWL)
            .withdrawTokens(TWENTY_ETH, julieWL.address)
        ).to.be.revertedWith("IncorrectWithdrawal(5000000000000000000)");

        // withdraws remaining 5
        await spaceCoinICO
          .connect(julieWL)
          .withdrawTokens(FIVE_ETH, julieWL.address);

        // tries to withdraw more when no more is available
        await expect(
          spaceCoinICO
            .connect(julieWL)
            .withdrawTokens(TWENTY_FIVE_ETH, julieWL.address)
        ).to.be.revertedWith("IncorrectWithdrawal(0)");
      });

      it("user trying to withdraw in SEED phase should fail", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        // julie contributes 25 eth
        await spaceCoinICO
          .connect(julieWL)
          .contribute({ value: TWENTY_FIVE_ETH });

        // we are still in seed phase so should fail
        await expect(
          spaceCoinICO
            .connect(julieWL)
            .withdrawTokens(TWENTY_FIVE_ETH, julieWL.address)
        ).to.be.revertedWith(errors.withdrawOnlyOpen);
      });

      it("user trying to withdraw in GENERAL phase should fail", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        // julie contributes 25 eth
        await spaceCoinICO
          .connect(julieWL)
          .contribute({ value: TWENTY_FIVE_ETH });

        await spaceCoinICO.updatePhaseStatus(Status.GENERAL);

        await expect(
          spaceCoinICO
            .connect(julieWL)
            .withdrawTokens(TWENTY_FIVE_ETH, julieWL.address)
        ).to.be.revertedWith(errors.withdrawOnlyOpen);
      });

      it("withdrawal of tokens should not be available if ICO is paused", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        // julie contributes 25 eth
        await spaceCoinICO
          .connect(julieWL)
          .contribute({ value: TWENTY_FIVE_ETH });

        await spaceCoinICO.updatePhaseStatus(Status.OPEN);
        await spaceCoinICO.setPauseStatus(true);

        await expect(
          spaceCoinICO
            .connect(julieWL)
            .withdrawTokens(TWENTY_FIVE_ETH, julieWL.address)
        ).to.be.revertedWith(errors.onlyActive);
      });

      it("withdrawal of tokens should happen automatically if contributed during open phase", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        await spaceCoinICO.updatePhaseStatus(Status.OPEN);

        // julie contributes 25 eth
        await spaceCoinICO
          .connect(julieWL)
          .contribute({ value: TWENTY_FIVE_ETH });

        const julieBalance = await spaceCoinToken.balanceOf(julieWL.address);

        expect(julieBalance).to.eq(HUNDRED_TWENTY_FIVE_ETH);

        // ensuring that token state in ico is correct
        const julieState = await spaceCoinICO.contributors(julieWL.address);

        expect(julieState.tokensDistributed).to.eq(HUNDRED_TWENTY_FIVE_ETH);
      });

      it("mix of manual & automated withdrawal of tokens scenario", async () => {
        await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing

        // during seed phase
        await spaceCoinICO.connect(julieWL).contribute({ value: FIVE_ETH });

        await spaceCoinICO.updatePhaseStatus(Status.OPEN);

        // julie contributes 25 eth during open phase
        await spaceCoinICO
          .connect(julieWL)
          .contribute({ value: TWENTY_FIVE_ETH });

        const julieBalance = await spaceCoinToken.balanceOf(julieWL.address);

        expect(julieBalance).to.eq(HUNDRED_TWENTY_FIVE_ETH);

        // ensuring that token state in ico is correct
        const julieState = await spaceCoinICO.contributors(julieWL.address);
        expect(julieState.tokensDistributed).to.eq(HUNDRED_TWENTY_FIVE_ETH);

        // there are still 25 tokens available from seed phase that we will not withdraw
        await spaceCoinICO
          .connect(julieWL)
          .withdrawTokens(TWENTY_FIVE_ETH, julieWL.address);

        const julieBalance2 = await spaceCoinToken.balanceOf(julieWL.address);

        expect(julieBalance2).to.eq(HUNDRED_FIFTY_ETH);
      });
    });

    describe("Direct Interaction with ERC20 Contract", () => {
      const setUpForTokens = async () => {
        await spaceCoinICO.setPauseStatus(false);
        await spaceCoinICO.updatePhaseStatus(Status.OPEN);
        await spaceCoinICO
          .connect(julieWL)
          .contribute({ value: TWENTY_FIVE_ETH }); // should get 125 tokens
        await spaceCoinICO.connect(bob).contribute({ value: FIVE_ETH }); // should get 25 tokens
      };
      // const toggleTaxStatus = spaceCoinICO.toggleTaxStatus;
      // const icoAddress = spaceCoinICO.address;

      it("random person cannot mint", async () => {
        await expect(
          spaceCoinToken.connect(bob).safeMint(bob.address, ONE_ETH)
        ).to.be.revertedWith(errors.tokenNonAdmin);
      });

      it("simple transfer works without tax", async () => {
        await setUpForTokens();
        await spaceCoinToken.connect(julieWL).transfer(junWL.address, ONE_ETH);

        expect(await spaceCoinToken.balanceOf(junWL.address)).to.eq(ONE_ETH);
      });

      it("tax toggle works from ICO contract", async () => {
        // false by default
        expect(await spaceCoinToken.isTaxable()).to.eq(false);

        await spaceCoinICO.toggleTaxStatus();
        // true after 1 toggle
        expect(await spaceCoinToken.isTaxable()).to.eq(true);

        await spaceCoinICO.toggleTaxStatus();
        // false after 2 toggles
        expect(await spaceCoinToken.isTaxable()).to.eq(false);
      });

      it("random person cannot switch tax toggle on ICO and Token contract", async () => {
        await expect(
          spaceCoinICO.connect(bob).toggleTaxStatus()
        ).to.be.revertedWith(errors.nonAdmin);

        await expect(
          spaceCoinToken.connect(bob).toggleTaxStatus()
        ).to.be.revertedWith(errors.tokenNonAdmin);
      });

      it("simple transfer works with TAX (treasury gets 2%)", async () => {
        await setUpForTokens();
        await spaceCoinICO.toggleTaxStatus();
        await spaceCoinToken.connect(julieWL).transfer(junWL.address, ONE_ETH);

        expect(await spaceCoinToken.balanceOf(junWL.address)).to.eq(
          ethers.utils.parseEther("0.98")
        );
        expect(await spaceCoinToken.balanceOf(treasuryAddr.address)).to.eq(
          ethers.utils.parseEther("0.02")
        );
      });

      it("more complex transfer works with TAX (treasury gets 2%)", async () => {
        await setUpForTokens();
        await spaceCoinICO.toggleTaxStatus(); // turned on
        await spaceCoinToken.connect(julieWL).transfer(junWL.address, ONE_ETH); // .98  /  .02
        await spaceCoinToken.connect(bob).transfer(junWL.address, TWENTY_ETH); // 19.6  / .4

        await spaceCoinICO.toggleTaxStatus(); // turned off so nothing goes to treasury
        await spaceCoinToken.connect(bob).transfer(junWL.address, ONE_ETH); //  1   / 0

        expect(await spaceCoinToken.balanceOf(junWL.address)).to.eq(
          ethers.utils.parseEther("21.58") // 19.6 + .98 + 1
        );
        expect(await spaceCoinToken.balanceOf(treasuryAddr.address)).to.eq(
          ethers.utils.parseEther("0.42") // .02 + 0.4 + 0
        );
      });

      it("simple transferFrom works w/o tax", async () => {
        await setUpForTokens();
        await spaceCoinToken.connect(bob).approve(julieWL.address, ONE_ETH);
        await spaceCoinToken
          .connect(julieWL)
          .transferFrom(bob.address, junWL.address, ONE_ETH);

        expect(await spaceCoinToken.balanceOf(junWL.address)).to.eq(ONE_ETH);
      });

      it("simple transferFrom works with TAX", async () => {
        await setUpForTokens();
        await spaceCoinICO.toggleTaxStatus();
        await spaceCoinToken.connect(bob).approve(julieWL.address, ONE_ETH);
        await spaceCoinToken
          .connect(julieWL)
          .transferFrom(bob.address, junWL.address, ONE_ETH);

        expect(await spaceCoinToken.balanceOf(junWL.address)).to.eq(
          ethers.utils.parseEther("0.98")
        );
        expect(await spaceCoinToken.balanceOf(treasuryAddr.address)).to.eq(
          ethers.utils.parseEther("0.02")
        );
      });

      it("more complex transferFrom works with TAX", async () => {
        await setUpForTokens();
        await spaceCoinICO.toggleTaxStatus(); // turned on
        await spaceCoinToken.connect(bob).approve(julieWL.address, FIVE_ETH);
        await spaceCoinToken.connect(julieWL).approve(alice.address, FIVE_ETH);
        await spaceCoinToken
          .connect(julieWL)
          .transferFrom(bob.address, junWL.address, ONE_ETH); // jun 0.98 / treasury 0.02

        await spaceCoinToken
          .connect(alice)
          .transferFrom(
            julieWL.address,
            junWL.address,
            ethers.utils.parseEther("1.5")
          ); // jun 1.47 / treasury 0.03

        await spaceCoinICO.toggleTaxStatus(); // turned off
        await spaceCoinToken
          .connect(julieWL)
          .transferFrom(bob.address, junWL.address, ONE_ETH); // jun 1 / treasury 0

        expect(await spaceCoinToken.balanceOf(junWL.address)).to.eq(
          ethers.utils.parseEther("3.45") // 0.98, 1.47, 1
        );
        expect(await spaceCoinToken.balanceOf(treasuryAddr.address)).to.eq(
          ethers.utils.parseEther("0.05") // 0.02, 0.03, 0
        );
      });

      it("making sure safeMint cannot mint more than 500k tokens", async () => {
        await deploySoloERC20();
        await spaceCoinToken
          .connect(deployer)
          .safeMint(bob.address, FIVE_HUNDRED_K_ETH);

        // we were able to mint 500k
        expect(await spaceCoinToken.balanceOf(bob.address)).to.eq(
          FIVE_HUNDRED_K_ETH
        );

        // we cannot mint more
        await expect(
          spaceCoinToken.connect(deployer).safeMint(bob.address, ONE_ETH)
        ).to.be.revertedWith(errors.tokenLimit);
      });
    });

    describe("ICO Events", () => {
      it("contribute event is emitted", async () => {
        await spaceCoinICO.setPauseStatus(false);
        await spaceCoinICO.connect(julieWL).contribute({ value: ONE_ETH });

        const event = await spaceCoinICO.queryFilter(
          spaceCoinICO.filters.Contribute()
        );

        expect(event.length).to.eq(1);

        const { contributor, amount, phaseStatus } = event[0].args;
        expect(contributor).to.eq(julieWL.address);
        expect(amount).to.eq(ONE_ETH);
        expect(phaseStatus).to.eq(Status.SEED);
      });
      it("pause event is emitted", async () => {
        await spaceCoinICO.setPauseStatus(false);

        const event = await spaceCoinICO.queryFilter(
          spaceCoinICO.filters.Paused()
        );

        expect(event.length).to.eq(1);

        const { isPaused } = event[0].args;
        expect(isPaused).to.eq(false);
      });
      it("tax toggle event is emitted", async () => {
        await spaceCoinICO.toggleTaxStatus();

        const event = await spaceCoinICO.queryFilter(
          spaceCoinICO.filters.TaxToggle()
        );

        expect(event.length).to.eq(1);

        const { isTaxed } = event[0].args;
        expect(isTaxed).to.eq(true);
      });
      it("token withdrawal event is emitted", async () => {
        await spaceCoinICO.setPauseStatus(false);
        await spaceCoinICO.updatePhaseStatus(Status.OPEN);
        await spaceCoinICO.connect(bob).contribute({ value: FIVE_ETH });

        const event = await spaceCoinICO.queryFilter(
          spaceCoinICO.filters.TokensWithdrawn()
        );

        expect(event.length).to.eq(1);

        const { amount, contributor } = event[0].args;
        expect(amount).to.eq(TWENTY_FIVE_ETH);
        expect(contributor).to.eq(bob.address);
      });
      it("setPhase status event is emitted", async () => {
        await spaceCoinICO.updatePhaseStatus(Status.OPEN);

        const event = await spaceCoinICO.queryFilter(
          spaceCoinICO.filters.PhaseStatusUpdated()
        );

        expect(event.length).to.eq(1);

        const { phaseStatus } = event[0].args;
        expect(phaseStatus).to.eq(Status.OPEN);
      });
    });

    // other tests

    // it("x in isPaused=x, phaseStatus=x", async () => {
    //   await spaceCoinICO.setPauseStatus(false); // inital update to enable users to start contributing
    // });
  });
});
