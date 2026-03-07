"use client";

import { useState } from "react";
import { Copy, Eye, EyeOff, RefreshCw, Shield, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface ApiKeyManagerProps {
  apiKey: string;
  ipWhitelist: string[];
  onRotateKey: () => Promise<string>;
  onUpdateIpWhitelist: (ips: string[]) => Promise<string[]>;
  isLoading?: boolean;
}

export function ApiKeyManager({
  apiKey,
  ipWhitelist,
  onRotateKey,
  onUpdateIpWhitelist,
  isLoading = false,
}: ApiKeyManagerProps) {
  const { toast } = useToast();
  const [showKey, setShowKey] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isSavingIps, setIsSavingIps] = useState(false);
  const [ipInput, setIpInput] = useState(ipWhitelist.join(", "));
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      toast({
        title: "Скопировано",
        description: "API ключ скопирован в буфер обмена",
      });
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать ключ",
        variant: "destructive",
      });
    }
  };

  const handleRotate = async () => {
    setIsRotating(true);
    try {
      await onRotateKey();
      toast({
        title: "Успешно",
        description: "API ключ был обновлен",
      });
      setConfirmDialogOpen(false);
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить API ключ",
        variant: "destructive",
      });
    } finally {
      setIsRotating(false);
    }
  };

  const handleSaveIpWhitelist = async () => {
    setIsSavingIps(true);
    try {
      // Parse IPs from comma-separated string
      const ips = ipInput
        .split(",")
        .map((ip) => ip.trim())
        .filter((ip) => ip.length > 0);
      
      await onUpdateIpWhitelist(ips);
      toast({
        title: "Успешно",
        description: "Список IP адресов обновлен",
      });
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить список IP адресов",
        variant: "destructive",
      });
    } finally {
      setIsSavingIps(false);
    }
  };

  const maskedKey = apiKey
    ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
    : "***...***";

  return (
    <div className="space-y-6">
      {/* API Key Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            API Ключ
          </CardTitle>
          <CardDescription>
            Используйте этот ключ для аутентификации вашего агента в API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Важно</AlertTitle>
            <AlertDescription>
              Не передавайте этот ключ третьим лицам. При утечке ключа немедленно обновите его.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Текущий ключ</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? "text" : "password"}
                value={showKey ? apiKey : maskedKey}
                readOnly
                className="font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? "Скрыть" : "Показать"}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                title="Копировать"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Обновить API ключ
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Подтверждение</DialogTitle>
                <DialogDescription>
                  Вы уверены, что хотите обновить API ключ? Старый ключ перестанет работать немедленно.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                  Отмена
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleRotate}
                  disabled={isRotating}
                >
                  {isRotating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Обновление...
                    </>
                  ) : (
                    "Обновить"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* IP Whitelist Section */}
      <Card>
        <CardHeader>
          <CardTitle>IP Whitelist</CardTitle>
          <CardDescription>
            Ограничьте доступ к API только с указанных IP адресов (оставьте пустым для разрешения всех)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ip-whitelist">Разрешенные IP адреса</Label>
            <textarea
              id="ip-whitelist"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="192.168.1.1, 10.0.0.1, ..."
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              disabled={isSavingIps}
            />
            <p className="text-sm text-muted-foreground">
              Введите IP адреса через запятую
            </p>
          </div>
          <Button 
            onClick={handleSaveIpWhitelist} 
            disabled={isSavingIps}
            className="w-full"
          >
            {isSavingIps ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              "Сохранить IP whitelist"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default ApiKeyManager;
