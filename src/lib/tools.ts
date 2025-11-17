import { Tool, tool } from "ai";
import { z } from "zod";

export const lookUpCustomerByPhoneNumber: Tool = ({
    name: "lookupCustomerByPhoneNumber",
    description: "You have greeted the customer and asked for their phone number. They have provided it. Look up a customer by their phone number to retrieve their information and authenticate them.",
    inputSchema: z.object({
        phoneNumber: z.string().describe("The provided phone number to look up"),
    }), 
    outputSchema: z.object({
        customerObject: z.object({
            customerId: z.string().describe("The customer's ID"),
            firstName: z.string().describe("The customer's first name"),
            lastName: z.string().describe("The customer's last name"),
            phoneNumber: z.string().describe("The customer's account phone number"),
            customerEmail: z.string().describe("The customer's email address"),
        }),
        message: z.string().describe("The audio response to the user after greeting them and asking for their phone number"),
       
    }),
    execute:async ( phoneNumber: string) => {
        //psuedocode
        // find cusomter where customer.phone = phoneNumber
        // return customer object
        return {
            match: true,
            customerObject: {
                customerId: "123",
                firstName: "John",
                lastName: "Doe",
                phoneNumber: "123-456-7890",
                customerEmail: "john.doe@example.com",
            },
            //or  match: false
        }

    },
})


export const listCustomerClaims: Tool = ({
    name: "listCustomerClaims",
    description: "List a customer's claims by their customer ID",
    inputSchema: z.object({
        customerId: z.string().describe("The customer's ID"),
    }), 
    outputSchema: z.object({
        claims: z.array(z.object({
           claimId: z.string().describe("The claim's ID"),
           claimShortDescription: z.string().describe("The claim's short description"),
           claimAmount: z.number().describe("The claim's amount"),
           claimSubmitDate: z.string().describe("The claim's date"),
        })),
        message: z.string().describe("The audio response to the user after greeting them and asking for their phone number"),
    }),
    execute:async ( customerId: string) => {
        //psuedocode
        // find all claims associated with customer
        // return customer object
        return {
           claims: [],
           message: ""
        }

    },
})

export const lookupClaimById: Tool = ({
    name: "lookupClaimById",
    description: "Lookup a customers claim by its ID",
    inputSchema: z.object({
        claimId: z.string().describe("The claim's ID"),
    }), 
    outputSchema: z.object({
        claimObject: z.object({
            claimId: z.string().describe("The claim's ID"),
            claimShortDescription: z.string().describe("The claim's short description"),
            claimAmount: z.number().describe("The claim's amount"),
            claimSubmitDate: z.string().describe("The claim's date"),
        }),
        message: z.string().describe("The audio response to the user after greeting them and asking for their phone number"),
    }),
    execute:async ( claimId: string) => {
        //psuedocode
        // find claim where claim.id = claimId
        // return claim object
        return {
           claimObject: {
               claimId: "123",
               claimShortDescription: "Claim 123",
               claimAmount: 123,
               claimSubmitDate: "2022-01-01",
           },
           message: ""
        }

    },
})
    