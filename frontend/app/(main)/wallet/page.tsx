"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Wallet, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownRight,
  Loader2,
  RefreshCw,
  DollarSign,
  Briefcase,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";
import { walletApi, type Transaction, type TransactionType } from "@/lib/api";

const transactionTypeConfig: Record<TransactionType, { label: string; color: string; icon: React.ReactNode }> = {
  DEPOSIT: { label: "Deposit", color: "bg-green-100 text-green-800", icon: <ArrowUpRight className="h-4 w-4" /> },
  WITHDRAWAL: { label: "Withdrawal", color: "bg-red-100 text-red-800", icon: <ArrowDownRight className="h-4 w-4" /> },
  TASK_PAYMENT: { label: "Task Payment", color: "bg-orange-100 text-orange-800", icon: <Briefcase className="h-4 w-4" /> },
  TASK_REFUND: { label: "Task Refund", color: "bg-blue-100 text-blue-800", icon: <RotateCcw className="h-4 w-4" /> },
  TASK_REWARD: { label: "Task Reward", color: "bg-green-100 text-green-800", icon: <DollarSign className="h-4 w-4" /> },
  FEE: { label: "Fee", color: "bg-gray-100 text-gray-800", icon: <AlertCircle className="h-4 w-4" /> },
  ADJUSTMENT: { label: "Adjustment", color: "bg-purple-100 text-purple-800", icon: <ShieldCheck className="h-4 w-4" /> },
};

export default function WalletPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async (cursor?: string) => {
    try {
      const response = await walletApi.getTransactions({ limit: 20, cursor });
      
      if (cursor) {
        setTransactions((prev) => [...prev, ...response.transactions]);
      } else {
        setTransactions(response.transactions);
      }
      
      setNextCursor(response.nextCursor);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load transactions",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (nextCursor) {
      loadTransactions(nextCursor);
    }
  };

  const formatAmount = (amount: number, type: TransactionType) => {
    const isPositive = ["DEPOSIT", "TASK_REWARD", "TASK_REFUND"].includes(type);
    const prefix = isPositive ? "+" : "";
    return `${prefix}$${Math.abs(amount).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Кошелек</h1>
        <p className="text-muted-foreground mt-1">
          Управляйте вашим балансом и транзакциями
        </p>
      </div>

      {/* Balance Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Баланс</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${user?.balance.toFixed(2) || "0.00"}</div>
            <p className="text-xs text-muted-foreground">Доступно для использования</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Заморожено</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${user?.frozen.toFixed(2) || "0.00"}</div>
            <p className="text-xs text-muted-foreground">В активных задачах</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${((user?.balance || 0) + (user?.frozen || 0)).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Общий баланс</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>История транзакций</CardTitle>
          <CardDescription>
            Список всех операций с вашим кошельком
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length > 0 ? (
            <div className="space-y-4">
              {transactions.map((transaction) => {
                const config = transactionTypeConfig[transaction.type];
                const isPositive = ["DEPOSIT", "TASK_REWARD", "TASK_REFUND"].includes(transaction.type);
                
                return (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${config.color}`}>
                        {config.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{config.label}</span>
                          <Badge variant="outline" className="text-xs">
                            {transaction.id.slice(0, 8)}
                          </Badge>
                        </div>
                        {transaction.comment && (
                          <p className="text-sm text-muted-foreground">{transaction.comment}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(transaction.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${isPositive ? "text-green-600" : "text-red-600"}`}>
                        {formatAmount(transaction.amount, transaction.type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Balance: ${transaction.balanceAfter.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {nextCursor && (
                <div className="text-center pt-4">
                  <Button variant="outline" onClick={handleLoadMore}>
                    Load More
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No transactions yet</p>
              <p className="text-sm mt-1">Your transaction history will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
