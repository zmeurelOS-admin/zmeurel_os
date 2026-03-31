import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

import { handleMeteoRequest } from '../_shared/meteo-handler.ts'

serve(handleMeteoRequest)
