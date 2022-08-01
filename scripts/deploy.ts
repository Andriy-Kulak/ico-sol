// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  const acct1 = process.env.WL_ADDRESS_1 as string;
  const acct2 = process.env.WL_ADDRESS_2 as string;
  const treasuryAcct = process.env.TREASURY_ADDRESS as string;

  console.log("yyy1 accounts:", {
    jul: acct1,
    jun: acct2,
    tre: treasuryAcct,
  });
  const gnosisSafe = "0x285e3f6E67DD19e6ab1891A3FeDC4D6C699dc035";
  // We get the contract to deploy
  console.log("yyy1 test 1");
  const SpaceCoinICO = await ethers.getContractFactory("SpaceCoinICO");
  console.log("yyy1 test 2");
  const spaceCoinICO = await SpaceCoinICO.deploy(
    [acct1, acct2],
    treasuryAcct,
    gnosisSafe
  );
  console.log("yyy1 test 3");
  // const Greeter = await ethers.getContractFactory("Greeter");
  // const greeter = await Greeter.deploy("Hello, Hardhat!");

  await spaceCoinICO.deployed();

  console.log("yyy1 test 3.5");

  // we want to unpause ICO and make it status open so people can contribute
  // await spaceCoinICO.setPauseStatus(false);
  // await spaceCoinICO.updatePhaseStatus(2);

  console.log("ICO deployed to:", spaceCoinICO.address);

  console.log(
    "ICO deployed to: await spaceCoinICO.scToken()",
    await spaceCoinICO.scToken()
  );

  // await spaceCoinICO.contribute({ value: ethers.utils.parseEther("1")});

  console.log("yyy1 test 5");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
