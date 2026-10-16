import { currentUser } from '../../../../lib/auth'; import { json } from '../../../../lib/server-security';
export const runtime='nodejs'; export async function GET(){const user=await currentUser();return json({user});}
