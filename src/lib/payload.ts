import { getPayload } from 'payload'
import config   from '../payload.config'

export async function getPayloadClient() {
    return getPayload({config})
}

//get payload is the recommended way to access running payload instance in server code. 
//It is not recommended to use the payload config directly in server code.
// do not use getpayloadhmr anymore. this is deprecated
