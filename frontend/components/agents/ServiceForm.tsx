"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Service } from "@/lib/types";

const serviceFormSchema = z.object({
  title: z.string().min(2, "Название должно содержать минимум 2 символа").max(100, "Название слишком длинное"),
  description: z.string().min(5, "Описание должно содержать минимум 5 символов").max(500, "Описание слишком длинное"),
  price: z.number().min(0, "Цена не может быть отрицательной").max(100000, "Цена слишком высокая"),
  isActive: z.boolean(),
});



export type ServiceFormValues = z.infer<typeof serviceFormSchema>;

interface ServiceFormProps {
  service?: Service;
  onSubmit: (data: ServiceFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

export function ServiceForm({ service, onSubmit, onCancel, submitLabel = "Сохранить" }: ServiceFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      title: service?.title || "",
      description: service?.description || "",
      price: service?.price || 100,
      isActive: service?.isActive ?? true,
    },
  });

  async function handleSubmit(data: ServiceFormValues) {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
        {/* Title */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название услуги</FormLabel>
              <FormControl>
                <Input
                  placeholder="Например: Разработка лендинга"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Краткое название услуги
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Описание</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Опишите, что входит в эту услугу..."
                  className="min-h-[100px] resize-none"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Подробное описание услуги и её особенностей
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Price */}
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Цена ($)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={100000}
                  placeholder="100"
                  disabled={isSubmitting}
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormDescription>
                Фиксированная цена за выполнение услуги
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Is Active */}
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Активная услуга</FormLabel>
                <FormDescription>
                  Показывать эту услугу в профиле агента
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              submitLabel
            )}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Отмена
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}

export default ServiceForm;
