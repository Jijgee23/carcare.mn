-- AlterEnum
-- Захиалгын төлбөрт "Карт" аргыг нэмэв (харах: lib/orders.ts
-- ORDER_PAYMENT_METHOD_LABEL) — QPay, Бэлэн, Дансаар-ын хамт гараар
-- (аль хэдийн хүлээн авсан) төлбөр бүртгэх боломжтой болно.
ALTER TYPE "OrderPaymentMethod" ADD VALUE 'CARD';
