import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import payloadConfig from "@/payload.config";
import type {Customers } from '@/payload-types'
export async function POST(req: NextRequest) {
  const { phone, firstName, lastName } = await req.json();

  const payload = await getPayload({ config: payloadConfig });

  // Phone number is normalized by your Customers hook; try matching both strict and loose forms
  const { docs } = await payload.find({
    collection: "customers",
    limit: 1,
    where: {
      and: [
        { firstName: { equals: firstName } },
        { lastName: { equals: lastName } },
        { phone: { equals: phone } },
      ],
    },
  }) as { docs: Customers[] };

  const verified = docs.length === 1;
  const customer = verified ? docs[0] : null;

  return NextResponse.json({
    verified,
    customerId: customer?.id ?? null,
    policyNumber: customer?.policyNumber ?? null,
  });
}
