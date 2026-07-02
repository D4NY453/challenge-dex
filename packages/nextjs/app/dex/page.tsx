"use client";

import { useEffect, useRef, useState } from "react";
import { Curve, Curve3D } from "./_components";
import { Address, AddressInput, Balance, EtherInput } from "@scaffold-ui/components";
import { IntegerInput } from "@scaffold-ui/debug-contracts";
import { useWatchBalance } from "@scaffold-ui/hooks";
import type { NextPage } from "next";
import { Address as AddressType, formatEther, isAddress, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeftRight, 
  Coins, 
  Droplet, 
  Layers, 
  ArrowUpRight, 
  Info, 
  Rotate3d, 
  Sparkles,
  TrendingUp
} from "lucide-react";

// REGEX for number inputs (only allow numbers and a single decimal point)
const NUMBER_REGEX = /^\.?\d+\.?\d*$/;

const Dex: NextPage = () => {
  const curveWrapRef = useRef<HTMLDivElement>(null);
  const [curveSize, setCurveSize] = useState(480);
  
  // Interactive UI States
  const [activeTab, setActiveTab] = useState<"swap" | "liquidity" | "token">("swap");
  const [activeSwapType, setActiveSwapType] = useState<"ethToToken" | "tokenToEth">("ethToToken");
  const [activeLiquidityType, setActiveLiquidityType] = useState<"deposit" | "withdraw">("deposit");
  const [is3DMode, setIs3DMode] = useState(true);

  // Form inputs
  const [ethToTokenAmount, setEthToTokenAmount] = useState("");
  const [tokenToETHAmount, setTokenToETHAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [approveSpender, setApproveSpender] = useState("");
  const [approveAmount, setApproveAmount] = useState("");
  const [accountBalanceOf, setAccountBalanceOf] = useState("");

  const [ethToTokenInputKey, setEthToTokenInputKey] = useState(0);
  const [depositInputKey, setDepositInputKey] = useState(0);
  const [withdrawInputKey, setWithdrawInputKey] = useState(0);

  const { data: DEXInfo } = useDeployedContractInfo({ contractName: "DEX" });
  const { data: BalloonsInfo } = useDeployedContractInfo({ contractName: "Balloons" });
  const { address: connectedAccount } = useAccount();

  const { data: DEXBalloonBalance } = useScaffoldReadContract({
    contractName: "Balloons",
    functionName: "balanceOf",
    args: [DEXInfo?.address?.toString()],
  });

  useEffect(() => {
    const el = curveWrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      const width = entry?.contentRect?.width ?? 0;
      if (!Number.isFinite(width) || width <= 0) return;
      const next = Math.max(260, Math.min(480, Math.floor(width)));
      setCurveSize(next);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { data: DEXtotalLiquidity } = useScaffoldReadContract({
    contractName: "DEX",
    functionName: "totalLiquidity",
  });

  const { writeContractAsync: writeDexContractAsync } = useScaffoldWriteContract({ contractName: "DEX" });
  const { writeContractAsync: writeBalloonsContractAsync } = useScaffoldWriteContract({ contractName: "Balloons" });

  const { data: balanceOfWrite } = useScaffoldReadContract({
    contractName: "Balloons",
    functionName: "balanceOf",
    args: [accountBalanceOf as AddressType],
    query: {
      enabled: isAddress(accountBalanceOf),
    },
  });

  const { data: contractBalance } = useScaffoldReadContract({
    contractName: "Balloons",
    functionName: "balanceOf",
    args: [DEXInfo?.address],
  });

  const { data: userBalloons } = useScaffoldReadContract({
    contractName: "Balloons",
    functionName: "balanceOf",
    args: [connectedAccount],
  });

  const { data: userLiquidity } = useScaffoldReadContract({
    contractName: "DEX",
    functionName: "getLiquidity",
    args: [connectedAccount],
  });

  const { data: contractETHBalance } = useWatchBalance({ address: DEXInfo?.address });

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-950 via-slate-900 to-black text-slate-100 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Premium Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-semibold mb-4 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
            Speedrun Ethereum - Challenge 5
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4 bg-gradient-to-r from-violet-300 via-indigo-200 to-sky-300 bg-clip-text text-transparent">
            Constant Product DEX
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">
            Swap assets instantly and provide liquidity using an automated constant product ($x \times y = k$) market maker.
          </p>

          {/* User Balances Header Row */}
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="px-5 py-3 rounded-2xl bg-slate-900/60 border border-violet-500/15 backdrop-blur-md flex items-center gap-3 shadow-lg shadow-black/35"
            >
              <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400 font-bold border border-pink-500/25">
                🎈
              </div>
              <div className="text-left">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Your BAL Balance</span>
                <span className="font-mono font-bold text-slate-200 text-sm">
                  {userBalloons ? parseFloat(formatEther(userBalloons)).toFixed(4) : "0.0000"} BAL
                </span>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="px-5 py-3 rounded-2xl bg-slate-900/60 border border-violet-500/15 backdrop-blur-md flex items-center gap-3 shadow-lg shadow-black/35"
            >
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 font-bold border border-violet-500/25">
                💦
              </div>
              <div className="text-left">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Your Liquidity Shares</span>
                <span className="font-mono font-bold text-slate-200 text-sm">
                  {userLiquidity ? parseFloat(formatEther(userLiquidity)).toFixed(4) : "0.0000"} LPT
                </span>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Controls & Forms (7 cols) */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-7 space-y-6"
          >
            {/* Main Tabs Controller Card */}
            <div className="bg-slate-900/40 border border-violet-500/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
              
              {/* Tab Navigation */}
              <div className="flex border-b border-violet-500/15 pb-4 mb-6 gap-2">
                <button
                  onClick={() => setActiveTab("swap")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all relative ${
                    activeTab === "swap" ? "text-violet-300 bg-violet-500/10 border border-violet-500/25 shadow-lg shadow-violet-500/5" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Swap Trades
                </button>
                <button
                  onClick={() => setActiveTab("liquidity")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all relative ${
                    activeTab === "liquidity" ? "text-violet-300 bg-violet-500/10 border border-violet-500/25 shadow-lg shadow-violet-500/5" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  <Droplet className="w-4 h-4" />
                  Liquidity Pool
                </button>
                <button
                  onClick={() => setActiveTab("token")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all relative ${
                    activeTab === "token" ? "text-violet-300 bg-violet-500/10 border border-violet-500/25 shadow-lg shadow-violet-500/5" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  BAL Utility
                </button>
              </div>

              {/* Tab Body Contents */}
              <AnimatePresence mode="wait">
                {activeTab === "swap" && (
                  <motion.div
                    key="swap"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {/* Swap Inner Type Select */}
                    <div className="grid grid-cols-2 p-1 bg-slate-950/60 rounded-xl border border-violet-500/10">
                      <button
                        onClick={() => {
                          setTokenToETHAmount("");
                          setActiveSwapType("ethToToken");
                        }}
                        className={`py-2 rounded-lg font-semibold text-sm transition-all ${
                          activeSwapType === "ethToToken" ? "bg-violet-500/15 text-violet-300 border border-violet-500/25" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        ETH → Balloons
                      </button>
                      <button
                        onClick={() => {
                          setEthToTokenAmount("");
                          setActiveSwapType("tokenToEth");
                        }}
                        className={`py-2 rounded-lg font-semibold text-sm transition-all ${
                          activeSwapType === "tokenToEth" ? "bg-violet-500/15 text-violet-300 border border-violet-500/25" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Balloons → ETH
                      </button>
                    </div>

                    {/* Swap Form inputs */}
                    {activeSwapType === "ethToToken" ? (
                      <div className="space-y-4">
                        <div className="bg-slate-950/40 border border-violet-500/10 rounded-2xl p-5">
                          <label className="text-xs font-bold text-slate-400 block mb-2">Sell Amount (ETH)</label>
                          <EtherInput
                            key={ethToTokenInputKey}
                            defaultValue={ethToTokenAmount}
                            onValueChange={({ valueInEth }) => {
                              setTokenToETHAmount("");
                              setEthToTokenAmount(valueInEth);
                            }}
                            name="ethToToken"
                          />
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={async () => {
                            try {
                              await writeDexContractAsync({
                                functionName: "ethToToken",
                                value: NUMBER_REGEX.test(ethToTokenAmount) ? parseEther(ethToTokenAmount) : 0n,
                              });
                              setEthToTokenAmount("");
                              setTokenToETHAmount("");
                              setEthToTokenInputKey(k => k + 1);
                            } catch (err) {
                              console.error("Error calling ethToToken function", err);
                            }
                          }}
                          className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 font-bold transition-all text-white shadow-lg shadow-indigo-900/30 flex items-center justify-center gap-2 border border-violet-500/20"
                        >
                          <ArrowUpRight className="w-5 h-5" />
                          Execute ETH → BAL Swap
                        </motion.button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-slate-950/40 border border-violet-500/10 rounded-2xl p-5">
                          <label className="text-xs font-bold text-slate-400 block mb-2">Sell Amount (BAL)</label>
                          <IntegerInput
                            value={tokenToETHAmount}
                            onChange={value => {
                              setEthToTokenAmount("");
                              setTokenToETHAmount(value.toString());
                            }}
                            name="tokenToETH"
                            disableMultiplyBy1e18
                            placeholder="Enter Balloons quantity"
                          />
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={async () => {
                            try {
                              await writeDexContractAsync({
                                functionName: "tokenToEth",
                                args: [NUMBER_REGEX.test(tokenToETHAmount) ? parseEther(tokenToETHAmount) : tokenToETHAmount],
                              });
                              setEthToTokenAmount("");
                              setTokenToETHAmount("");
                              setEthToTokenInputKey(k => k + 1);
                            } catch (err) {
                              console.error("Error calling tokenToEth function", err);
                            }
                          }}
                          className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 font-bold transition-all text-white shadow-lg shadow-sky-900/30 flex items-center justify-center gap-2 border border-indigo-500/20"
                        >
                          <ArrowUpRight className="w-5 h-5" />
                          Execute BAL → ETH Swap
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "liquidity" && (
                  <motion.div
                    key="liquidity"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {/* Liquidity Inner Type Select */}
                    <div className="grid grid-cols-2 p-1 bg-slate-950/60 rounded-xl border border-violet-500/10">
                      <button
                        onClick={() => setActiveLiquidityType("deposit")}
                        className={`py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                          activeLiquidityType === "deposit" ? "bg-violet-500/15 text-violet-300 border border-violet-500/25" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Deposit Assets
                      </button>
                      <button
                        onClick={() => setActiveLiquidityType("withdraw")}
                        className={`py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                          activeLiquidityType === "withdraw" ? "bg-violet-500/15 text-violet-300 border border-violet-500/25" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Withdraw Assets
                      </button>
                    </div>

                    {/* Liquidity Forms */}
                    {activeLiquidityType === "deposit" ? (
                      <div className="space-y-4">
                        <div className="bg-slate-950/40 border border-violet-500/10 rounded-2xl p-5">
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-slate-400">Add Liquidity (ETH)</label>
                            <span className="text-[10px] text-violet-400 font-bold">Pulls BAL proportionally + 1 wei</span>
                          </div>
                          <EtherInput
                            key={depositInputKey}
                            defaultValue={depositAmount}
                            onValueChange={({ valueInEth }) => setDepositAmount(valueInEth)}
                          />
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={async () => {
                            try {
                              await writeDexContractAsync({
                                functionName: "deposit",
                                value: NUMBER_REGEX.test(depositAmount) ? parseEther(depositAmount) : 0n,
                              });
                              setDepositAmount("");
                              setDepositInputKey(k => k + 1);
                            } catch (err) {
                              console.error("Error calling deposit function", err);
                            }
                          }}
                          className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 font-bold transition-all text-white shadow-lg shadow-indigo-900/30 flex items-center justify-center gap-2 border border-violet-500/20"
                        >
                          <Droplet className="w-5 h-5" />
                          Deposit Liquidity
                        </motion.button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-slate-950/40 border border-violet-500/10 rounded-2xl p-5">
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-slate-400">Withdraw LP Tokens (LPT)</label>
                            <span className="text-[10px] text-violet-400 font-bold">Returns proportional ETH and BAL</span>
                          </div>
                          <EtherInput
                            key={withdrawInputKey}
                            defaultValue={withdrawAmount}
                            onValueChange={({ valueInEth }) => setWithdrawAmount(valueInEth)}
                          />
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={async () => {
                            try {
                              await writeDexContractAsync({
                                functionName: "withdraw",
                                args: [NUMBER_REGEX.test(withdrawAmount) ? parseEther(withdrawAmount) : withdrawAmount],
                              });
                              setWithdrawAmount("");
                              setWithdrawInputKey(k => k + 1);
                            } catch (err) {
                              console.error("Error calling withdraw function", err);
                            }
                          }}
                          className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 font-bold transition-all text-white shadow-lg shadow-sky-900/30 flex items-center justify-center gap-2 border border-indigo-500/20"
                        >
                          <Droplet className="w-5 h-5" />
                          Withdraw Liquidity
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "token" && (
                  <motion.div
                    key="token"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5"
                  >
                    {BalloonsInfo?.address && (
                      <div className="bg-slate-950/40 border border-violet-500/10 rounded-2xl p-5">
                        <span className="text-xs text-slate-400 block mb-2 font-bold uppercase">Balloons Token Address</span>
                        <Address address={BalloonsInfo.address} />
                      </div>
                    )}
                    {/* Approve spender form */}
                    <div className="bg-slate-950/40 border border-violet-500/10 rounded-2xl p-5 space-y-4">
                      <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-pink-500" />
                        Approve spender allowance
                      </h4>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Spender Address</label>
                        <AddressInput
                          value={approveSpender ?? ""}
                          onChange={value => setApproveSpender(value)}
                          placeholder="Address to authorize (e.g. DEX address)"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Allowance (BAL)</label>
                        <IntegerInput
                          value={approveAmount}
                          onChange={value => setApproveAmount(value.toString())}
                          placeholder="Amount of tokens to approve"
                          disableMultiplyBy1e18
                        />
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={async () => {
                          try {
                            await writeBalloonsContractAsync({
                              functionName: "approve",
                              args: [
                                approveSpender as AddressType,
                                NUMBER_REGEX.test(approveAmount) ? parseEther(approveAmount) : approveAmount,
                              ],
                            });
                            setApproveSpender("");
                            setApproveAmount("");
                          } catch (err) {
                            console.error("Error calling approve function", err);
                          }
                        }}
                        className="w-full py-2.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/35 border border-violet-500/30 text-violet-300 font-bold transition-all text-sm"
                      >
                        Submit Approval
                      </motion.button>
                    </div>

                    {/* Balance checker form */}
                    <div className="bg-slate-950/40 border border-violet-500/10 rounded-2xl p-5 space-y-3">
                      <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        Check BAL Balance
                      </h4>
                      <AddressInput
                        value={accountBalanceOf}
                        onChange={value => setAccountBalanceOf(value)}
                        placeholder="Enter user address"
                      />
                      {balanceOfWrite !== undefined && (
                        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 font-mono text-center font-bold text-sm">
                          BAL Balance: {parseFloat(formatEther(balanceOfWrite || 0n)).toFixed(4)} BAL
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* DEX Pool Overview Card */}
            <div className="bg-slate-900/40 border border-violet-500/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
              <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                Reserves & Pool Information
              </h3>
              
              {DEXInfo?.address && (
                <div className="mb-4 bg-slate-950/30 border border-violet-500/5 rounded-2xl p-4">
                  <span className="text-xs text-slate-400 block mb-2 font-bold uppercase">DEX Contract Address</span>
                  <Address address={DEXInfo.address} />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/30 border border-violet-500/5 rounded-2xl p-4 text-center">
                  <span className="text-xs text-slate-400 block mb-1">DEX ETH Reserve</span>
                  <div className="text-lg font-mono font-black text-indigo-300">
                    <Balance address={DEXInfo?.address} />
                  </div>
                </div>

                <div className="bg-slate-950/30 border border-violet-500/5 rounded-2xl p-4 text-center">
                  <span className="text-xs text-slate-400 block mb-1">DEX BAL Reserve</span>
                  <div className="text-lg font-mono font-black text-pink-400">
                    🎈 {DEXBalloonBalance ? parseFloat(formatEther(DEXBalloonBalance)).toFixed(4) : "0.0000"}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-violet-500/10 flex justify-between text-sm text-slate-400">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-slate-500" />
                  <span>Total Liquidity Share Pool (k)</span>
                </div>
                <span className="font-mono font-bold text-violet-300">
                  {DEXtotalLiquidity ? parseFloat(formatEther(DEXtotalLiquidity)).toFixed(4) : "0.0000"} LPT
                </span>
              </div>
            </div>
          </motion.div>

          {/* RIGHT COLUMN: Interactive Chart (5 cols) */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-5 space-y-6"
          >
            {/* Chart Wrapper Card */}
            <div ref={curveWrapRef} className="w-full">
              {/* Curve Toggle Controls */}
              <div className="flex justify-end gap-2 mb-3">
                <button
                  onClick={() => setIs3DMode(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    !is3DMode ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  2D Flat
                </button>
                <button
                  onClick={() => setIs3DMode(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    is3DMode ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Rotate3d className="w-3.5 h-3.5" />
                  3D Orbit
                </button>
              </div>

              {/* Dynamic Chart Render */}
              {is3DMode ? (
                <Curve3D
                  addingEth={ethToTokenAmount !== "" ? parseFloat(ethToTokenAmount) : 0}
                  addingToken={tokenToETHAmount !== "" ? parseFloat(tokenToETHAmount) : 0}
                  ethReserve={parseFloat(formatEther(contractETHBalance?.value || 0n))}
                  tokenReserve={parseFloat(formatEther(contractBalance || 0n))}
                  width={curveSize}
                  height={curveSize}
                />
              ) : (
                <Curve
                  addingEth={ethToTokenAmount !== "" ? parseFloat(ethToTokenAmount) : 0}
                  addingToken={tokenToETHAmount !== "" ? parseFloat(tokenToETHAmount) : 0}
                  ethReserve={parseFloat(formatEther(contractETHBalance?.value || 0n))}
                  tokenReserve={parseFloat(formatEther(contractBalance || 0n))}
                  width={curveSize}
                  height={curveSize}
                />
              )}
            </div>

            {/* Information Card */}
            <div className="bg-slate-900/40 border border-violet-500/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
              <h4 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                <Info className="w-4.5 h-4.5 text-violet-400" />
                Constant Product Market Making
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                This exchange utilizes the formula $x \times y = k$ to maintain automated asset reserves. 
              </p>
              <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                <li>$x$ represents the balance of ETH in the contract.</li>
                <li>$y$ represents the balance of Balloons ($BAL$).</li>
                <li>$k$ is the invariant product that is kept constant during trades.</li>
                <li>Each trade incurs a <strong className="text-violet-300">0.3% fee</strong> which is added back to pool reserves, growing $k$ for liquidity providers.</li>
              </ul>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
};

export default Dex;
