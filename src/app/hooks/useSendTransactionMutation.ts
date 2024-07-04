import { useToast } from "@/components/ui/use-toast";
import { useMagic } from "@/providers/MagicProvider";
import { SolanaContext } from "@/providers/SolanaProvider";
import { useMagicTokenStore } from "@/store/magicTokenStore";
import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    ParsedAccountData,
    PublicKey,
    sendAndConfirmTransaction,
    SystemProgram,
    Transaction,
} from "@solana/web3.js";
import { useMutation } from "@tanstack/react-query";
import { Dispatch, SetStateAction, useContext } from "react";
import spl, { getOrCreateAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token";
import { SolanaDevnetTokenAddress } from "@/constants/tokenAddress";
import bs58 from "bs58";

async function getNumberDecimals({ connection, currency }: { connection: Connection; currency: "USDC" | "EURC" }) {
    const mintAddress = currency === "USDC" ? SolanaDevnetTokenAddress.USDC : currency === "EURC" ? SolanaDevnetTokenAddress.EURC : "";
    if (mintAddress === "") return;

    const info = await connection!.getParsedAccountInfo(new PublicKey(SolanaDevnetTokenAddress.USDC));
    const result = (info.value?.data as ParsedAccountData).parsed.info.decimals as number;
    return result;
}

export function useSendTransactionMutation({ setSignature }: { setSignature: Dispatch<SetStateAction<string>> }) {
    const { connection } = useContext(SolanaContext);
    const { magic } = useMagic();
    const { publicAddress } = useMagicTokenStore();

    const { toast } = useToast();
    return useMutation({
        mutationKey: ["sendTransactionMutation"],
        mutationFn: async ({ currency, toAddress, amount }: { currency: "Solana" | "USDC" | "EURC"; toAddress: string; amount: number }) => {
            const fromPublicKey = new PublicKey(publicAddress);
            const toPublicKey = new PublicKey(toAddress);

            if (!PublicKey.isOnCurve(toPublicKey.toBuffer())) {
                toast({
                    title: "Invalid user address",
                    style: {
                        top: "50px",
                        color: "red",
                    },
                });
                return;
            }
            if (isNaN(Number(amount))) {
                toast({
                    title: "Invalid amount",
                    style: {
                        top: "50px",
                        color: "red",
                    },
                });
                return;
            }

            try {
                const hash = await connection?.getLatestBlockhash();
                if (!hash) return;

                const paymasterKeypair = Keypair.fromSecretKey(bs58.decode(process.env.NEXT_PUBLIC_MY_SOLANA_DEVNET_PRIVATE_KEY as string));

                const transaction = new Transaction({
                    feePayer: fromPublicKey,
                    ...hash,
                });

                switch (currency) {
                    case "Solana":
                        const lamportsAmount = Number(amount) * LAMPORTS_PER_SOL;
                        console.log("amount: " + lamportsAmount);
                        const transfer = SystemProgram.transfer({
                            fromPubkey: fromPublicKey,
                            toPubkey: toPublicKey,
                            lamports: lamportsAmount,
                        });
                        transaction.add(transfer);

                        break;
                    case "USDC":
                        console.log("send USDC");
                        try {
                            let usdcSourceAccount = await getOrCreateAssociatedTokenAccount(
                                connection!,
                                paymasterKeypair,
                                new PublicKey(SolanaDevnetTokenAddress.USDC),
                                fromPublicKey
                            );

                            console.log("usdcSourceAccount: " + usdcSourceAccount.address.toBase58());

                            let usdcDestinationAccount = await getOrCreateAssociatedTokenAccount(
                                connection!,
                                paymasterKeypair,
                                new PublicKey(SolanaDevnetTokenAddress.USDC),
                                toPublicKey
                            );

                            const usdcNumberDecimals = await getNumberDecimals({ connection: connection!, currency: "USDC" });
                            if (!usdcNumberDecimals) return;

                            transaction.add(
                                createTransferInstruction(
                                    usdcSourceAccount.address,
                                    usdcDestinationAccount.address,
                                    fromPublicKey,
                                    Number(amount) * Math.pow(10, usdcNumberDecimals)
                                )
                            );
                        } catch (e: any) {
                            console.log(e);
                        }

                        break;
                    case "EURC":
                        let eurcSourceAccount = await getOrCreateAssociatedTokenAccount(
                            connection!,
                            paymasterKeypair,
                            new PublicKey(SolanaDevnetTokenAddress.EURC),
                            fromPublicKey
                        );

                        let eurcDestinationAccount = await getOrCreateAssociatedTokenAccount(
                            connection!,
                            paymasterKeypair,
                            new PublicKey(SolanaDevnetTokenAddress.EURC),
                            toPublicKey
                        );

                        const eurcNumberDecimals = await getNumberDecimals({ connection: connection!, currency: "EURC" });
                        if (!eurcNumberDecimals) return;

                        transaction.add(
                            createTransferInstruction(
                                eurcSourceAccount.address,
                                eurcDestinationAccount.address,
                                fromPublicKey,
                                Number(amount) * Math.pow(10, eurcNumberDecimals)
                            )
                        );
                        break;
                    default:
                        throw new Error("Invalid currency");
                }

                const signedTransaction = await magic?.solana.signTransaction(transaction, {
                    requireAllSignatures: false,
                    verifySignatures: true,
                });

                const txSignature = await connection?.sendRawTransaction(
                    Buffer.from(signedTransaction?.rawTransaction as unknown as string, "base64")
                );

                if (!txSignature) {
                    throw new Error("Transaction failed");
                }

                setSignature(txSignature);
            } catch (e: any) {
                toast({
                    title: "Transaction failed",
                    description: e.message,
                    style: {
                        top: "50px",
                        color: "red",
                    },
                });
                console.log(e);
            }
        },
    });
}
