import { handleApiRequest } from '../_lib/router.mjs';

export async function onRequest(context) {
    return handleApiRequest(context.request, context.env);
}
