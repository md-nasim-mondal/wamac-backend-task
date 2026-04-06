import prisma from "../../../shared/prisma";
import { ICreateFxQuote } from "./fx.interface";

const createQuote = async (data: ICreateFxQuote) => {
  const { fromCurrency, toCurrency } = data;
  const simulatedRate =
    fromCurrency === "USD" && toCurrency === "EUR" ? 0.92 : 1.1;
  const expiresAt = new Date(Date.now() + 60 * 1000);

  const quote = await prisma.fxQuote.create({
    data: {
      fromCurrency,
      toCurrency,
      rate: simulatedRate,
      expiresAt,
    },
  });
  return quote;
};

const getQuote = async (id: string) => {
  const quote = await prisma.fxQuote.findUnique({
    where: { id },
  });
  if (!quote) throw new Error("Quote not found");

  const now = new Date();
  const expired = now > quote.expiresAt;
  if (expired) throw new Error("Quote expired");

  const timeRemainingMs = Math.max(
    0,
    quote.expiresAt.getTime() - now.getTime(),
  );
  return { ...quote, timeRemainingMs };
};

const useQuote = async (id: string) => {
  const result = await prisma.fxQuote.updateMany({
    where: {
      id,
      status: "UNUSED",
      expiresAt: { gt: new Date() },
    },
    data: { status: "USED" },
  });

  if (result.count === 0) {
    throw new Error("Quote already used, expired, or not found");
  }

  const quote = await prisma.fxQuote.findUnique({ where: { id } });
  if (!quote) throw new Error("Quote not found");
  return quote;
};

export const FxService = {
  createQuote,
  getQuote,
  useQuote,
};
