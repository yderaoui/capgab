import { ReceiptView } from "@/components/receipts/receipt";
export const metadata = { title: "Verify evidence receipt" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ReceiptView id={(await params).id} />;
}
