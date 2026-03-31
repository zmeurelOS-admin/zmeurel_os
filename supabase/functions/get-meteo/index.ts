/**
 * Alias al `fetch-meteo` pentru compatibilitate cu hostname-uri / fallback-uri vechi din client.
 * Ambele trebuie deploy-ate: `supabase functions deploy fetch-meteo` și `supabase functions deploy get-meteo`
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

import { handleMeteoRequest } from '../_shared/meteo-handler.ts'

serve(handleMeteoRequest)
