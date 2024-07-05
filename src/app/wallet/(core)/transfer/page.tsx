"use client";

import { Input } from "@/components/ui/input";
import { withAuthMagic } from "@/lib/hoc/withAuth";
import { SupabaseBrowserContext } from "@/providers/SupabaseBrowserProvider";
import { CircularProgress, debounce } from "@mui/material";
import { useCallback, useContext, useEffect, useState } from "react";

import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";

import { useSendTransactionMutation } from "@/app/hooks/useSendTransactionMutation";
import ShineBorder, { TColorProp } from "@/components/magicui/shine-border";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { isEmpty } from "lodash";
import { ChevronRightIcon, Disc3Icon } from "lucide-react";
import Image from "next/image";
import TransactionSuccess from "./success";
import { useMagic } from "@/providers/MagicProvider";
import { getIconByCurrency } from "@/utils/currencyIcon";

function Transfer() {
    const supabase = useContext(SupabaseBrowserContext);

    const { magic } = useMagic();
    const [ringColor, setRingColor] = useState(["#2775CA", "#fff"]);

    const [searchResults, setSearchResults] = useState<
        {
            id: string;
            email: string;
            publicAddress: string;
            created_at: string;
        }[]
    >([]);

    const [input, setInput] = useState("");
    const [open, setOpen] = useState(false);
    const [recipient, setRecipient] = useState({
        email: "",
        toAddress: "",
    });
    const [currency, setCurrency] = useState<"Solana" | "USDC" | "EURC">("USDC");

    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);

    const [signature, setSignature] = useState("");

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const searchEmail = useCallback(
        debounce(async ({ email }: { email: string }) => {
            try {
                setLoading(true);
                const { data: users } = await supabase.rpc("search_users", { prefix: email });
                setSearchResults(users);
            } catch (e) {
                console.log("error in saving to supabase: " + e);
            }
            setLoading(false);
        }, 300),
        [supabase]
    );

    useEffect(() => {
        if (input !== "") {
            searchEmail({ email: input });
        } else {
            setSearchResults([]);
        }
    }, [input, searchEmail]);

    useEffect(() => {
        switch (currency) {
            case "Solana":
                setRingColor(["#9945FF", "#14F195"]);
                break;
            case "USDC":
                setRingColor(["#2775CA", "#fff"]);
                break;
            case "EURC":
                setRingColor(["#2775CA", "#fff"]);
                break;
            default:
                break;
        }
    }, [currency]);

    const { mutateAsync: sendTransaction, isError, isSuccess, isPending } = useSendTransactionMutation({ setSignature });

    return (
        <div className="flex flex-col w-full h-full space-y-10 items-center p-4">
            {isSuccess && !isError ? (
                <TransactionSuccess signature={signature} toEmail={recipient.email} amount={amount} currency={currency} />
            ) : (
                <>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={open}
                                className={`${isPending ? "grayscale" : ""} w-[80vw] justify-between`}
                                disabled={isPending}
                            >
                                {recipient.toAddress !== ""
                                    ? searchResults.find((result) => result.publicAddress === recipient.toAddress)?.email
                                    : "Select recipient"}
                                <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[80vw] border-0">
                            <Command>
                                <CommandInput placeholder="Search user..." value={input} onValueChange={setInput} />

                                <CommandList className="drop-shadow-xl">
                                    {loading ? (
                                        <CommandEmpty>Searching user...</CommandEmpty>
                                    ) : (
                                        <>
                                            <CommandEmpty>No user found.</CommandEmpty>
                                            <CommandGroup>
                                                {searchResults.map((result) => (
                                                    <CommandItem
                                                        className="space-x-2"
                                                        key={result.id}
                                                        value={result.publicAddress}
                                                        onSelect={(currentValue) => {
                                                            setRecipient(
                                                                currentValue === recipient.toAddress
                                                                    ? {
                                                                          email: "",
                                                                          toAddress: "",
                                                                      }
                                                                    : {
                                                                          email: result.email,
                                                                          toAddress: currentValue,
                                                                      }
                                                            );
                                                            setOpen(false);
                                                        }}
                                                    >
                                                        <Avatar>
                                                            <AvatarFallback>{result.email.substring(0, 2)}</AvatarFallback>
                                                        </Avatar>
                                                        <span>{result.email}</span>
                                                        <CheckIcon
                                                            className={cn(
                                                                "ml-auto h-4 w-4",
                                                                recipient.toAddress === result.publicAddress ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </>
                                    )}
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    {!isEmpty(recipient.toAddress) ? (
                        <div className="flex h-[80%] py-40 items-center justify-between flex-col absolute left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-0">
                            <div className={`flex items-center w-full justify-between ${isPending && "grayscale"}`}>
                                <Input
                                    placeholder="0.00"
                                    type="number"
                                    className="h-14 w-40 text-6xl font-bold text-center border-0 focus-visible:ring-0 focus-visible:placeholder:opacity-0 caret-slate-500"
                                    onChange={(e) => setAmount(e.target.value)}
                                />

                                <Select
                                    defaultValue="USDC"
                                    value={currency}
                                    onValueChange={(value: "Solana" | "USDC" | "EURC") => setCurrency(value)}
                                >
                                    <ShineBorder
                                        className="text-center min-w-[80px] p-0 pl-[3px] size-[86px] text-2xl font-bold capitalize"
                                        color={ringColor as TColorProp}
                                        borderWidth={2}
                                    >
                                        <SelectTrigger className="size-[80px] border-0 flex flex-row justify-center items-center text-white focus:ring-0 focus:ring-offset-0 focus:border-0">
                                            <SelectValue placeholder="Currency" />
                                        </SelectTrigger>
                                    </ShineBorder>

                                    <SelectContent className="min-w-[80px] w-[80px]" side="bottom">
                                        {["Solana", "USDC", "EURC"].map((currency) => (
                                            <SelectItem
                                                key={currency}
                                                value={currency}
                                                className="w-[80px] min-w-[80px] px-0 flex justify-center items-center"
                                            >
                                                {getIconByCurrency(currency)} <span>{currency}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {recipient.toAddress && currency && (
                                <ShineBorder
                                    className="text-center min-w-12 min-h-12 w-18 h-18 p-1"
                                    color={ringColor as TColorProp}
                                    borderWidth={4}
                                    borderRadius={100}
                                >
                                    <Button
                                        className="size-16 rounded-full bg-background"
                                        onClick={async () => {
                                            await sendTransaction({
                                                currency,
                                                toAddress: recipient.toAddress,
                                                amount: parseFloat(amount),
                                            });
                                        }}
                                        disabled={isPending}
                                    >
                                        {isPending ? (
                                            <Disc3Icon className="animate-spin" color="white" size={24} />
                                        ) : (
                                            <ChevronRightIcon size={24} color="white" />
                                        )}
                                    </Button>
                                </ShineBorder>
                            )}
                        </div>
                    ) : (
                        <>
                            <span className="text-gray-500 line-clamp-1 w-full text-center absolute left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]">
                                Send transaction by selecting a recipient
                            </span>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

export default withAuthMagic(Transfer);
