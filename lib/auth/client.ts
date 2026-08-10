"use client";

import { createAuthClient } from "@neondatabase/auth/next";

/*
 * Browser-side Neon Auth client. Talks to the route handler mounted at
 * /api/auth/[...path], so no Neon Auth URL or secret is ever shipped to the
 * browser.
 */
export const authClient = createAuthClient();
