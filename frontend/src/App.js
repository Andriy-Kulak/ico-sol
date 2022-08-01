import React, { useState } from "react";
import { ethers } from "ethers";
import SpaceCoinICOJSON from "./SpaceCoinICO.json";
import SpaceCoinToknJSON from "./SpaceCoinToken.json";
import ex1 from "./imgs/ex1.png";
import ex2 from "./imgs/ex2.png";

import "./App.css";

function App() {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();

  const icoAddr = "0x8a02f7910a353cf3669ebD1a10cf9612fA1e4beB";
  const ERC20Addr = "0x48E155918808A0F26B962402B7c2566F14DdE545";
  const icoContract = new ethers.Contract(
    icoAddr,
    SpaceCoinICOJSON.abi,
    provider
  );

  const ercContract = new ethers.Contract(
    ERC20Addr,
    SpaceCoinToknJSON.abi,
    provider
  );

  window.ethers = ethers;
  window.provider = provider;
  window.signer = signer;
  window.contract = icoContract;

  const [isSignedIn, setSignIn] = useState(false);
  const [contributionAmount, setContribution] = useState(0.01);
  const [txDetails, setTransaction] = useState({
    hash: "",
    contributorAddress: "",
    from: "",
  });
  const [tokenBalance, checkBalance] = useState(0);

  const connectToMetamask = async () => {
    await provider.send("eth_requestAccounts", []);
    console.log("Signed in", await signer.getAddress());
    setSignIn(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (contributionAmount === 0) {
      alert("Contribution Amount must be bigger zero");
    } else {
      try {
        const resp = await icoContract.connect(signer).contribute({
          value: ethers.utils.parseEther(JSON.stringify(contributionAmount)),
        });
        setTransaction({
          hash: resp?.hash ? `https://goerli.etherscan.io/tx/${resp.hash}` : "",
          contributorAddress: resp?.from
            ? `https://goerli.etherscan.io/address/${resp.from}`
            : "",

          from: resp?.from || "",
        });
        alert("success!", {
          txDetails: resp?.hash,
          addressFrom: resp?.from,
        });
      } catch (e) {
        alert("Error:", e.message);
      }
    }
  };

  const checkTokens = async () => {
    const resp = await ercContract
      .connect(signer)
      .balanceOf(await signer.getAddress());

    if (resp) {
      console.log("resp ===>", resp);
      const formatted = ethers.utils.formatEther(resp);
      console.log("formatted ===>", formatted);
      checkBalance(formatted);
    }
  };

  const moveTokensToLp = async () => {
    console.log(
      "hitting the move to lp address 0x9Ff6A934caa228Ca37180e8a37b6f3B28cf310a3"
    );
    const resp = await icoContract
      .connect(signer)
      .withdrawFunds("0x9Ff6A934caa228Ca37180e8a37b6f3B28cf310a3");

    if (resp) {
      console.log("resp ===>", resp);
      const formatted = ethers.utils.formatEther(resp);
      console.log("formatted ===>", formatted);
      checkBalance(formatted);
    }
  };

  const safeMint = async () => {
    const resp = await icoContract.connect(signer).safeMint();

    if (resp) {
      console.log("resp ===>", resp);
      const formatted = ethers.utils.formatEther(resp);
      checkBalance(formatted);
    }
  };
  return (
    <div className="App">
      <div>
        <h3>Is Signed In: {JSON.stringify(isSignedIn)}</h3>
        <p>Make sure to use: Goerli Test Network when contrubuting</p>
        <p>2 Stpes: Connect to Metamask, & Contribute</p>
        <p>After Transaction succeeded, you can check your balance</p>
      </div>
      <div>
        <button onClick={() => connectToMetamask()}>
          1. Connect to Metamask
        </button>
      </div>
      <div>
        <form onSubmit={handleSubmit}>
          <label>
            Contribution Amount (in eth):
            <input
              type="text"
              value={contributionAmount}
              onChange={setContribution}
            />
          </label>
          <input type="submit" value="Submit" />
        </form>
      </div>

      <button onClick={() => moveTokensToLp()}>Withdraw Tokens to LP</button>

      <button onClick={() => safeMint()}>Safe Mint</button>

      <div>
        <p>
          <b>Tx details:</b>{" "}
          <a href={txDetails?.hash} target="_blank">
            {txDetails?.hash}
          </a>
        </p>
        <p>
          <b>Tx addressFrom:</b>{" "}
          <a href={txDetails?.contributorAddress} target="_blank">
            {txDetails?.contributorAddress}
          </a>
        </p>
      </div>
      <div>
        <h3>Balance: {JSON.stringify(tokenBalance)}</h3>
        <button onClick={() => checkTokens()}>
          Check Personal Token Balance
        </button>
      </div>

      <br />
      <br />
      <br />
      <h3>Example Screenshots</h3>
      <img src={ex1}></img>
      <img src={ex2}></img>
    </div>
  );
}

export default App;
