declare module 'npm:@supabase/supabase-js@2' {
  export function createClient(...args: unknown[]): {
    auth: {
      getUser(accessToken: string): Promise<{
        data: { user: { id: string } | null }
        error: { message: string } | null
      }>
    }
    from(table: string): {
      select(columns: string): {
        eq(column: string, value: unknown): any
        maybeSingle(): Promise<{ data: any; error: { message: string } | null }>
        limit(count: number): any
        order(column: string, options?: { ascending?: boolean }): any
        gt(column: string, value: string): any
        not(column: string, operator: string, value: null): any
      }
      insert(values: Record<string, unknown>): {
        select(columns: string): {
          limit(count: number): Promise<{ data: any[] | null; error: { message: string } | null }>
        }
      }
    }
  }
}

declare module 'https://deno.land/std@0.224.0/http/server.ts' {
  export function serve(handler: (request: Request) => Response | Promise<Response>): void
}

declare const Deno: {
  env: {
    get(name: string): string | undefined
  }
}
