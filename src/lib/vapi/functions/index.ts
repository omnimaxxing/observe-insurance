import { verifyCustomer } from "./verifyCustomer";
import { confirmIdentity } from "./confirmIdentity";
import { alternativeVerification } from "./alternativeVerification";
import { sendVerificationCode } from "./sendVerificationCode";
import { verifyEmailCode } from "./verifyEmailCode";
import { getClaimStatus } from "./getClaimStatus";
import { searchKnowledgeBase } from "./searchKnowledgeBase";
import { sendUploadLink } from "./sendUploadLink";
import { endCall } from "./endCall";

/**
 * Functions registry for Vapi function calls
 * All functions must return a result field that will be spoken by the AI
 */
export const vapiFunctions = {
  verifyCustomer,
  confirmIdentity,
  alternativeVerification,
  sendVerificationCode,
  verifyEmailCode,
  getClaimStatus,
  searchKnowledgeBase,
  sendUploadLink,
  endCall,
};

export type VapiFunctionName = keyof typeof vapiFunctions;
