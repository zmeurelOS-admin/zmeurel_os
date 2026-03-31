# STRUCTURE.md — Zmeurel OS File Tree
_Last updated: 2026-03-20 (session 4)_

> ⭐ = fișier cheie

---

## src/app/

### Root
| Fișier | Descriere |
|--------|-----------|
| `src/app/layout.tsx` ⭐ | Root layout — head, fonts, providers |
| `src/app/page.tsx` ⭐ | Landing page (marketing) |
| `src/app/providers.tsx` ⭐ | React Query client + DashboardAuthContext + AddActionContext |
| `src/app/global-error.tsx` | Global error boundary (Next.js) |
| `src/app/manifest.ts` | PWA manifest |
| `src/app/icon.tsx` | App icon (SVG) |
| `src/app/apple-icon.tsx` | Apple touch icon |
| `src/app/register/page.tsx` | Registration/signup page |
| `src/app/ajutor/page.tsx` | Help & support page |
| `src/app/confidentialitate/page.tsx` | Privacy policy |
| `src/app/termeni/page.tsx` | Terms of service |
| `src/app/icon-192.png/route.tsx` | PWA icon 192×192 route |
| `src/app/icon-512.png/route.tsx` | PWA icon 512×512 route |

### (auth) — public routes
| Fișier | Descriere |
|--------|-----------|
| `src/app/(auth)/login/page.tsx` | Login server component (renders LoginPageClient) |
| `src/app/(auth)/login/LoginPageClient.tsx` ⭐ | Login form cu react-hook-form + Supabase auth |
| `src/app/(auth)/reset-password/page.tsx` | Formular actualizare parolă |
| `src/app/(auth)/reset-password-request/page.tsx` | Cerere reset parolă prin email |
| `src/app/(auth)/update-password/page.tsx` | Actualizare parolă după reset |

### (onboarding) — demo + signup
| Fișier | Descriere |
|--------|-----------|
| `src/app/(onboarding)/start/page.tsx` ⭐ | Pagina demo/signup: selectare tip fermă → creare demo |
| `src/app/(onboarding)/start/layout.tsx` | Layout onboarding (fără sidebar) |

### (dashboard) — pagini protejate
| Fișier | Descriere |
|--------|-----------|
| `src/app/(dashboard)/layout.tsx` ⭐ | Layout dashboard: citește headerele injectate de middleware, furnizează DashboardAuthContext |
| `src/app/(dashboard)/error.tsx` | Error boundary pentru dashboard |
| `src/app/(dashboard)/dashboard/page.tsx` ⭐ | Dashboard activ: compoziție UI peste engine-ul logic 2.0 |
| `src/lib/dashboard/engine.ts` ⭐ | Engine logic Dashboard 2.0: raw data, parcel states, tasks/alerts/summary/weather builders |
| `src/app/(dashboard)/dashboard/loading.tsx` | Skeleton pentru dashboard |
| `src/app/(dashboard)/dashboard/error.tsx` | Error state dashboard |
| `src/app/(dashboard)/activitati-agricole/page.tsx` ⭐ | Pagina activități agricole — IMPLEMENTAREA REALĂ (client complet cu useQuery) |
| `src/app/(dashboard)/activitati-agricole/ActivitatiAgricolePageClient.tsx` | ⚠️ COD MORT — UI static demo vechi, neutilizat |
| `src/app/(dashboard)/activitati-agricole/loading.tsx` | Skeleton activități |
| `src/app/(dashboard)/parcele/page.tsx` | Server component parcele — importă `ParcelePageClient` din `src/components/parcele/` |
| `src/app/(dashboard)/parcele/ParcelaPageClient.tsx` | ⚠️ NEUTILIZAT — page.tsx importă din components/parcele/ParcelePageClient |
| `src/app/(dashboard)/parcele/loading.tsx` | Skeleton parcele |
| `src/app/(dashboard)/parcele/[id]/page.tsx` ⭐ | Detalii teren individual — client component complet cu AddActivitateAgricolaDialog + AddRecoltareDialog inline |
| `src/app/(dashboard)/recoltari/page.tsx` | Server component recoltări |
| `src/app/(dashboard)/recoltari/RecoltariPageClient.tsx` ⭐ | Client component recoltări |
| `src/app/(dashboard)/recoltari/new/page.tsx` | Formular recoltare nouă |
| `src/app/(dashboard)/recoltari/loading.tsx` | Skeleton recoltări |
| `src/app/(dashboard)/recoltari/error.tsx` | Error state recoltări |
| `src/app/(dashboard)/vanzari/page.tsx` | Server component vânzări |
| `src/app/(dashboard)/vanzari/VanzariPageClient.tsx` ⭐ | Client component vânzări |
| `src/app/(dashboard)/vanzari/loading.tsx` | Skeleton vânzări |
| `src/app/(dashboard)/vanzari/error.tsx` | Error state vânzări |
| `src/app/(dashboard)/vanzari-butasi/page.tsx` | Server component vânzări butași |
| `src/app/(dashboard)/vanzari-butasi/VanzariButasiPageClient.tsx` ⭐ | Client component vânzări butași (material săditor) |
| `src/app/(dashboard)/vanzari-butasi/loading.tsx` | Skeleton vânzări butași |
| `src/app/(dashboard)/cheltuieli/page.tsx` | Server component cheltuieli |
| `src/app/(dashboard)/cheltuieli/CheltuialaPageClient.tsx` ⭐ | Client component cheltuieli diverse |
| `src/app/(dashboard)/cheltuieli/loading.tsx` | Skeleton cheltuieli |
| `src/app/(dashboard)/cheltuieli/error.tsx` | Error state cheltuieli |
| `src/app/(dashboard)/investitii/page.tsx` | Server component investiții |
| `src/app/(dashboard)/investitii/InvestitiiPageClient.tsx` ⭐ | Client component investiții de capital |
| `src/app/(dashboard)/investitii/loading.tsx` | Skeleton investiții |
| `src/app/(dashboard)/comenzi/page.tsx` | Server component comenzi |
| `src/app/(dashboard)/comenzi/ComenziPageClient.tsx` ⭐ | Client component comenzi clienți |
| `src/app/(dashboard)/comenzi/loading.tsx` | Skeleton comenzi |
| `src/app/(dashboard)/comenzi/error.tsx` | Error state comenzi |
| `src/app/(dashboard)/clienti/page.tsx` | Server component clienți |
| `src/app/(dashboard)/clienti/ClientPageClient.tsx` ⭐ | Client component gestionare clienți |
| `src/app/(dashboard)/clienti/loading.tsx` | Skeleton clienți |
| `src/app/(dashboard)/culegatori/page.tsx` | Server component culegători |
| `src/app/(dashboard)/culegatori/CulegatorPageClient.tsx` ⭐ | Client component gestionare culegători/harvesters |
| `src/app/(dashboard)/culegatori/loading.tsx` | Skeleton culegători |
| `src/app/(dashboard)/stocuri/page.tsx` | Server component stocuri |
| `src/app/(dashboard)/stocuri/StocuriPageClient.tsx` ⭐ | Client component gestiune stocuri cu filtre avansate |
| `src/app/(dashboard)/stocuri/loading.tsx` | Skeleton stocuri |
| `src/app/(dashboard)/stocuri/error.tsx` | Error state stocuri |
| `src/app/(dashboard)/rapoarte/page.tsx` | Server component rapoarte |
| `src/app/(dashboard)/rapoarte/RapoartePageClient.tsx` ⭐ | Client component rapoarte & analytics |
| `src/app/(dashboard)/rapoarte/loading.tsx` | Skeleton rapoarte |
| `src/app/(dashboard)/planuri/page.tsx` | Pagina planuri (placeholder) |
| `src/app/(dashboard)/settings/page.tsx` ⭐ | Setări cont: ștergere fermă, GDPR, integrări Google |
| `src/app/(dashboard)/ui-template-demo/page.tsx` | Showcase componente UI |
| `src/app/(dashboard)/admin/layout.tsx` ⭐ | Enforce isSuperAdmin înainte de orice pagină admin |
| `src/app/(dashboard)/admin/page.tsx` | Superadmin dashboard |
| `src/app/(dashboard)/admin/analytics/page.tsx` | Analytics admin — server component |
| `src/app/(dashboard)/admin/analytics/AnalyticsAdminClient.tsx` ⭐ | Dashboard analytics complet cu grafice |
| `src/app/(dashboard)/admin/audit/page.tsx` | Audit logs superadmin |

### api/
| Fișier | Descriere |
|--------|-----------|
| `src/app/api/auth/callback/route.ts` ⭐ | Callback OAuth Supabase |
| `src/app/api/auth/beta-guest/route.ts` | Creare cont demo (guest) |
| `src/app/api/auth/beta-signup/route.ts` | Înregistrare beta |
| `src/app/api/admin/tenant-plan/route.ts` | Gestionare planuri subscripție (service role) |
| `src/app/api/profile/phone/route.ts` | PATCH profil utilizator: validare + normalizare telefon |
| `src/app/api/chat/route.ts` ⭐ | Endpoint principal AI chat |
| `src/app/api/chat/chat-post-handler.ts` ⭐ | Orchestrator AI chat (routing, clarificări, open_form, fallback-uri) |
| `src/app/api/chat/contract-helpers.ts` | Contracte structured output + validare strictă prefill |
| `src/app/api/chat/conversation-memory.ts` | Memorie scurtă conversațională din `ai_conversations` |
| `src/app/api/chat/date-helpers.ts` | Helperi pentru date relative în timezone local |
| `src/app/api/chat/extractors.ts` | Extractori regex pentru sume, kg, date, parcele, produse, telefon |
| `src/app/api/chat/flow-detection.ts` ⭐ | Detectare flow + canonical candidates + friendly messages |
| `src/app/api/chat/signal-detectors.ts` | Detectoare de intenții pentru routing deterministic |
| `src/app/api/chat/utils.ts` | Utilitare comune pentru normalizare și erori |
| `src/app/api/chat/ai-usage-limit.ts` | Gating/rate limit AI chat |
| `src/app/api/chat/count/route.ts` | Endpoint count usage pentru widget-ul AI |
| `src/app/api/chat/usage/route.ts` | Endpoint usage AI/telemetrie |
| `src/app/api/cron/google-contacts-sync/route.ts` | Cron zilnic 18:00 UTC — sync contacte Google |
| `src/app/api/cron/admin-metrics-daily/route.ts` | Cron zilnic 03:00 UTC — agregare metrici tenant |
| `src/app/api/cron/demo-tenant-cleanup/route.ts` ⭐ | Cron zilnic 04:00 UTC — ștergere tenants demo >24h |
| `src/app/api/demo/seed/route.ts` | Generare date demo |
| `src/app/api/demo/reset/route.ts` | Reset tenant demo |
| `src/app/api/demo/reload/route.ts` | Reîncărcare date demo |
| `src/app/api/farm/reset/route.ts` ⭐ | Ștergere completă date fermă (GDPR) |
| `src/app/api/gdpr/account/route.ts` | Ștergere cont + date personale (GDPR) |
| `src/app/api/gdpr/farm/route.ts` | Ștergere date fermă (GDPR) |
| `src/app/api/integrations/google/connect/route.ts` | Inițiere OAuth Google |
| `src/app/api/integrations/google/callback/route.ts` | Callback OAuth Google |
| `src/app/api/integrations/google/import/route.ts` | Import contacte din Google Contacts |

---

## src/components/

### app/ — componente generale aplicație
| Fișier | Descriere |
|--------|-----------|
| `src/components/app/AppDialog.tsx` | Dialog generic refolosibil |
| `src/components/app/AppShell.tsx` ⭐ | Wrapper layout principal (header + content + FAB) |
| `src/components/app/ActionIcons.tsx` | Iconițe acțiuni standardizate |
| `src/components/app/AlertCard.tsx` | Card alertă cu dismiss |
| `src/components/app/BaseCard.tsx` | Card de bază cu styling agri |
| `src/components/app/BetaBanner.tsx` | Banner beta (versiune app/) |
| `src/components/app/BottomTabBar.tsx` ⭐ | Bottom tab bar activ pentru dashboard pe mobil (`md:hidden`) |
| `src/components/app/CompactListCard.tsx` | Card compact pentru liste |
| `src/components/app/ConfirmDeleteDialog.tsx` ⭐ | Dialog confirmare ștergere cu AlertDialog |
| `src/components/app/ConnectionStatus.tsx` | Indicator status conexiune |
| `src/components/app/DashboardAuthContext.tsx` ⭐ | Context: furnizează `{ userId, email, isSuperAdmin }` |
| `src/components/app/DensityProvider.tsx` | Context densitate UI (compact/comfortable) |
| `src/components/app/EmptyState.tsx` | Mesaj stare goală (versiune app/) |
| `src/components/app/EmptyStateBase.tsx` | Bază pentru componente EmptyState |
| `src/components/app/ErrorState.tsx` | Mesaj stare eroare |
| `src/components/app/FarmSwitcher.tsx` | Selector fermă activă |
| `src/components/app/OnboardingModal.tsx` ⭐ | Modal prima autentificare — colectare telefon contact |
| `src/components/app/FeedbackBanner.tsx` | Banner feedback WhatsApp — dismiss persistent în localStorage |
| `src/components/app/HighVisibilityInit.tsx` | Inițializare modul contrast ridicat |
| `src/components/app/HighVisibilityToggle.tsx` | Toggle contrast ridicat |
| `src/components/app/KpiCard.tsx` ⭐ | Card KPI cu valoare, trend, icon |
| `src/components/app/ListSkeleton.tsx` | Skeleton pentru liste |
| `src/components/app/LoadingState.tsx` | Indicator loading |
| `src/components/app/ModuleSkeletons.tsx` | Skeletons specifice module |
| `src/components/app/MonitoringInit.tsx` | Inițializare Sentry |
| `src/components/app/MoreMenu.tsx` | Conținutul meniului „Mai mult” pentru mobil |
| `src/components/app/MoreMenuDrawer.tsx` | Drawer/container pentru meniul „Mai mult” |
| `src/components/app/NavigationPerfLogger.tsx` | Logging performanță navigare |
| `src/components/app/NumericField.tsx` | Input numeric cu formatare |
| `src/components/app/PageHeader.tsx` ⭐ | Header pagină (titlu + acțiuni) |
| `src/components/app/PageViewTracker.tsx` | Tracking vizualizări pagini |
| `src/components/app/PerformanceTable.tsx` | Tabel performanță (rapoarte) |
| `src/components/app/ProfitSummaryCard.tsx` | Card sumar profit |
| `src/components/app/QuickActionsPanel.tsx` | Panou acțiuni rapide |
| `src/components/app/RouteTransitionIndicator.tsx` | Indicator tranziție rute |
| `src/components/app/ServiceWorkerRegister.tsx` | Înregistrare Service Worker |
| `src/components/app/StatusChip.tsx` | Badge status |
| `src/components/app/StickyActionBar.tsx` | Bară acțiuni sticky (mobilă) |
| `src/components/app/SyncBadge.tsx` | Indicator status sync |
| `src/components/app/ThemeProvider.tsx` | Provider temă light/dark via `next-themes` |
| `src/components/app/TopBar.tsx` ⭐ | Top navigation bar |
| `src/components/app/UserProfileMenu.tsx` | Meniu profil utilizator |
| `src/components/app/status-config.ts` | Configurare statusuri (culori, label) |
| `src/components/app/useMobileScrollRestore.ts` | Hook restaurare scroll mobil |

### ai/
| Fișier | Descriere |
|--------|-----------|
| `src/components/ai/AiBottomSheet.tsx` ⭐ | Widget AI principal: chat, voice input, confirm/open_form, handoff către module |
| `src/components/ai/AiPanel.tsx` | Overlay desktop pentru AI, reutilizează același conținut ca bottom sheet-ul mobil |

### layout/
| Fișier | Descriere |
|--------|-----------|
| `src/components/layout/BetaBanner.tsx` | Banner beta (versiune layout/) |
| `src/components/layout/CompactPageHeader.tsx` | Header pagină compact |
| `src/components/layout/Sidebar.tsx` ⭐ | Sidebar desktop `hidden md:flex`, collapsible, cu state salvat în `localStorage` |

### contexts/
| Fișier | Descriere |
|--------|-----------|
| `src/contexts/AiPanelContext.tsx` | Context client pentru starea overlay-ului desktop AI (`isAiPanelOpen`) |

### mobile/
| Fișier | Descriere |
|--------|-----------|
| `src/components/mobile/MobileBottomNav.tsx` | Variantă veche mobilă; `BottomTabBar.tsx` este tab bar-ul activ documentat |
| `src/components/mobile/MobileShell.tsx` | Wrapper layout mobil |
| `src/components/mobile/StickyActionButton.tsx` | Buton acțiune sticky FAB |

### dashboard/
| Fișier | Descriere |
|--------|-----------|
| `src/components/dashboard/DashboardCard.tsx` | Card dashboard generic |
| `src/components/dashboard/DashboardGrid.tsx` | Grid layout dashboard |
| `src/components/dashboard/DashboardWidgets.tsx` ⭐ | Setul de widget-uri configurabile pentru dashboard (KPI, comenzi, activități, recoltări, stocuri, venituri) |
| `src/components/dashboard/FinanciarAziCard.tsx` | KPI financial zilnic |
| `src/components/dashboard/MeteoDashboardCard.tsx` ⭐ | Cardul meteo activ din dashboard |
| `src/components/dashboard/ProductieAziCard.tsx` | KPI producție zilnică |
| `src/components/dashboard/SectionTitle.tsx` | Titlu secțiune dashboard |
| `src/components/dashboard/Sparkline.tsx` | Grafic sparkline mini |
| `src/components/dashboard/StatRow.tsx` | Rând statistici |
| `src/components/dashboard/TaskList.tsx` ⭐ | Lista activă „Todo azi” din dashboard |
| `src/components/dashboard/WelcomeCard.tsx` | Card onboarding pentru ferme fără parcele |
| `src/components/dashboard/index.ts` | Export barrel |

### Module-specific components

#### activitati-agricole/
| Fișier | Descriere |
|--------|-----------|
| `src/components/activitati-agricole/ActivitateAgricolaCard.tsx` | Card activitate agricolă |
| `src/components/activitati-agricole/ConfirmDeleteActivitateDialog.tsx` | Dialog confirmare ștergere activitate |

#### clienti/
| Fișier | Descriere |
|--------|-----------|
| `src/components/clienti/AddClientDialog.tsx` | Dialog creare client nou |
| `src/components/clienti/ClientDetailsDrawer.tsx` | Drawer detalii client |
| `src/components/clienti/ClientImportHelpDialog.tsx` | Dialog ajutor pentru formatul de import CSV/XLSX |
| `src/components/clienti/ClientImportPreviewPanel.tsx` | Preview validare/mapare înainte de import clienți |
| `src/components/clienti/ClientImportResultDialog.tsx` | Dialog rezultate import clienți |
| `src/components/clienti/EditClientDialog.tsx` | Dialog editare client |

#### comenzi/
| Fișier | Descriere |
|--------|-----------|
| `src/components/comenzi/ViewComandaDialog.tsx` | Dialog vizualizare detalii comandă |

#### culegatori/
| Fișier | Descriere |
|--------|-----------|
| `src/components/culegatori/AddCulegatorDialog.tsx` | Dialog adăugare culegător |
| `src/components/culegatori/CulegatorCard.tsx` | Card culegător |
| `src/components/culegatori/EditCulegatorDialog.tsx` | Dialog editare culegător |

---

## src/lib/

### dashboard/
| Fișier | Descriere |
|--------|-----------|
| `src/lib/dashboard/layout.ts` ⭐ | Tipuri, metadata și layout-ul default pentru widget-urile dashboard-ului configurabil |

### supabase/queries/
| Fișier | Descriere |
|--------|-----------|
| `src/lib/supabase/queries/profile-dashboard.ts` | Citire/scriere preferințe dashboard per user (`hide_onboarding`, `dashboard_layout`) |

#### parcele/
| Fișier | Descriere |
|--------|-----------|
| `src/components/parcele/AddParcelaDialog.tsx` ⭐ | Dialog creare parcelă nouă |
| `src/components/parcele/AddCulturaDialog.tsx` ⭐ | Dialog adăugare cultură pentru solar/parcela curentă |
| `src/components/parcele/EditCulturaDialog.tsx` | Dialog editare cultură existentă |
| `src/components/parcele/DesfiinteazaCulturaDialog.tsx` | Dialog desființare/închidere cultură |
| `src/components/parcele/DeleteConfirmDialog.tsx` | Dialog confirmare ștergere parcelă |
| `src/components/parcele/ParcelaCard.tsx` ⭐ | Card parcelă expandabil (collapse/expand) |
| `src/components/parcele/ParcelaForm.tsx` | Formular parcelă (câmpuri) |
| `src/components/parcele/ParceleLayout.tsx` | Wrapper layout parcele |
| `src/components/parcele/StickyActionBar.tsx` | Bară acțiuni sticky parcele |

#### recoltari/
| Fișier | Descriere |
|--------|-----------|
| `src/components/recoltari/ViewRecoltareDialog.tsx` | Dialog vizualizare detalii recoltare |

#### admin/
| Fișier | Descriere |
|--------|-----------|
| `src/components/admin/AdminTenantsPlanTable.tsx` | Tabel gestionare planuri tenants |

### Root components
| Fișier | Descriere |
|--------|-----------|
| `src/components/LogoutButton.tsx` ⭐ | Buton deconectare: `resetSupabaseInstance()` + `window.location.href='/login'` |
| `src/components/Navbar.tsx` | Navbar landing page (marketing) |
| `src/components/Toaster.tsx` | Provider toast (Sonner) |

### landing/ — componente marketing
| Fișier | Descriere |
|--------|-----------|
| `src/components/landing/about.tsx` | Secțiune despre |
| `src/components/landing/count-up.tsx` | Animație counter numeric |
| `src/components/landing/install.tsx` | Instrucțiuni instalare PWA |
| `src/components/landing/mobile.tsx` | Secțiune mobile |
| `src/components/landing/reveal.tsx` | Animație reveal scroll |
| `src/components/landing/story.tsx` | Secțiune poveste brand |

### ui/ — shadcn/ui + customizări
| Fișier | Descriere |
|--------|-----------|
| `src/components/ui/alert-dialog.tsx` | AlertDialog shadcn (confirm delete) |
| `src/components/ui/AlertCard.tsx` | Card alert (versiune ui/) |
| `src/components/ui/app-card.tsx` | Card aplicație generic |
| `src/components/ui/badge.tsx` | Badge shadcn |
| `src/components/ui/collapsible.tsx` | Collapsible shadcn pentru sidebar desktop |
| `src/components/ui/button.tsx` | Button shadcn |
| `src/components/ui/card.tsx` | Card shadcn |
| `src/components/ui/AiFab.tsx` | FAB AI flotant pentru deschiderea widgetului de chat |
| `src/components/ui/EmptyState.tsx` | Stare goală (versiune ui/) |
| `src/components/ui/form.tsx` | Form shadcn (react-hook-form integration) |
| `src/components/ui/form-dialog-layout.tsx` ⭐ | Wrapper dialog formular (titlu + butoane + submit) |
| `src/components/ui/input.tsx` | Input shadcn |
| `src/components/ui/label.tsx` | Label shadcn |
| `src/components/ui/ManualAddFab.tsx` | FAB manual pentru acțiunea de adăugare contextuală |
| `src/components/ui/MobileEntityCard.tsx` ⭐ | Card mobil standardizat pentru listele modulelor dashboard |
| `src/components/ui/MiniCard.tsx` | Card mini compact |
| `src/components/ui/ResponsiveDataView.tsx` | Switch reutilizabil mobil carduri / desktop DataTable cu sortare și search |
| `src/components/ui/SearchField.tsx` | Câmp căutare cu icon |
| `src/components/ui/select.tsx` | Select shadcn |
| `src/components/ui/separator.tsx` | Separator UI reutilizabil |
| `src/components/ui/sonner.tsx` | Sonner toast adapter |
| `src/components/ui/tooltip.tsx` | Tooltip shadcn pentru sidebar desktop |
| `src/components/ui/Sparkline.tsx` | Sparkline SVG (versiune ui/) |
| `src/components/ui/StatusBadge.tsx` ⭐ | Badge status cu culori configurabile |
| `src/components/ui/table.tsx` | Table shadcn |
| `src/components/ui/textarea.tsx` | Textarea shadcn |
| `src/components/ui/TrendBadge.tsx` | Badge trend ↑↓ |

---

## src/lib/

### supabase/
| Fișier | Descriere |
|--------|-----------|
| `src/lib/supabase/client.ts` ⭐ | `getSupabase()` singleton browser + `resetSupabaseInstance()` |
| `src/lib/supabase/server.ts` ⭐ | `createClient()` per-request server |
| `src/lib/supabase/admin.ts` ⭐ | `getSupabaseAdmin()` service role (bypass RLS) |
| `src/lib/supabase/business-ids.ts` | Generare ID-uri business (AA, CH, C, CUL, INV) |

### supabase/queries/ ⭐
| Fișier | Descriere |
|--------|-----------|
| `src/lib/supabase/queries/activitati-agricole.ts` ⭐ | CRUD activități agricole + calcul pauze |
| `src/lib/supabase/queries/parcele.ts` ⭐ | CRUD parcele + impact check referențial + fallback compat schema pentru coloane dashboard relevance |
| `src/lib/supabase/queries/recoltari.ts` ⭐ | CRUD recoltări via RPC (cu stock management) |
| `src/lib/supabase/queries/vanzari.ts` ⭐ | CRUD vânzări via RPC (cu stock management) |
| `src/lib/supabase/queries/comenzi.ts` ⭐ | CRUD comenzi + livrare + stock management |
| `src/lib/supabase/queries/vanzari-butasi.ts` ⭐ | CRUD vânzări butași cu line items |
| `src/lib/supabase/queries/clienti.ts` | CRUD clienți |
| `src/lib/supabase/queries/culegatori.ts` | CRUD culegători |
| `src/lib/supabase/queries/cheltuieli.ts` | CRUD cheltuieli diverse |
| `src/lib/supabase/queries/investitii.ts` | CRUD investiții de capital |
| `src/lib/supabase/queries/miscari-stoc.ts` ⭐ | Mișcări stoc, stoc global, filtre locații |
| `src/lib/supabase/queries/culturi.ts` | CRUD culturi sere/solarii |
| `src/lib/supabase/queries/crops.ts` | Catalog culturi global + auto-creare |
| `src/lib/supabase/queries/crop-varieties.ts` | Varietăți culturi |
| `src/lib/supabase/queries/manopera-auto.ts` | Creare automată cheltuieli manoperă din recoltări |
| `src/lib/supabase/queries/alertDismissals.ts` | Dismiss alerte |
| `src/lib/supabase/queries/solar-tracking.ts` | Tracking sere: stadii + climă |

### tenant/
| Fișier | Descriere |
|--------|-----------|
| `src/lib/tenant/get-tenant.ts` ⭐ | `getTenantId()` (throws) + `getTenantIdOrNull()` (silent) |

### auth/
| Fișier | Descriere |
|--------|-----------|
| `src/lib/auth/isSuperAdmin.ts` | Verificare `profiles.is_superadmin` |

### analytics/
| Fișier | Descriere |
|--------|-----------|
| `src/lib/analytics/track.ts` | `track(eventName, eventData?)` — folosește createClient() |
| `src/lib/analytics/trackEvent.ts` ⭐ | `trackEvent({ eventName, moduleName?, status?, metadata? })` — primary call |
| `src/lib/analytics/useTrackModuleView.ts` ⭐ | Hook fire-and-forget `view_module` la mount |

### offline/
| Fișier | Descriere |
|--------|-----------|
| `src/lib/offline/generateClientId.ts` | `generateClientId()` — UUID pentru idempotency |
| `src/lib/offline/syncEngine.ts` ⭐ | IndexedDB queue + retry cu exponential backoff |

### calculations/
| Fișier | Descriere |
|--------|-----------|
| `src/lib/calculations/profit.ts` | Calcule profit (recoltări, vânzări, cheltuieli) |
| `src/lib/calculations/stock-audit-thresholds.ts` | Praguri centralizate pentru auditul de stoc |
| `src/lib/calculations/stock-audit.ts` | Audit discrepanțe stoc |
| `src/lib/calculations/stock-reporting.ts` | Agregări multi-granulare pentru rapoarte de stoc |

### financial/
| Fișier | Descriere |
|--------|-----------|
| `src/lib/financial/categories.ts` | Normalizare categorii cheltuieli/investiții |
| `src/lib/financial/chat-router.ts` | Routing financiar deterministic pentru AI chat |

### subscription/
| Fișier | Descriere |
|--------|-----------|
| `src/lib/subscription/plans.ts` | Normalizare planuri și rezolvare plan efectiv |
| `src/lib/subscription/useMockPlan.ts` | Mock/helper plan pentru beta și testare |

### demo/
| Fișier | Descriere |
|--------|-----------|
| `src/lib/demo/demo-constants.ts` | Constante și marker-e pentru fluxurile demo |
| `src/lib/demo/demo-fixtures.ts` | Fixtures sintetice pentru seed demo |
| `src/lib/demo/demo-seed.ts` | Generare date demo per tip fermă |
| `src/lib/demo/demo-seed-service.ts` | Orchestrare seeding demo |
| `src/lib/demo/onboarding-storage.ts` | Local storage helpers pentru onboarding/demo mode |

### alerts/
| Fișier | Descriere |
|--------|-----------|
| `src/lib/alerts/engine.ts` | Motor evaluare/ordonare alerte fermă |
| `src/lib/alerts/generateFarmAlerts.ts` | Generator alerte fermă din date operaționale |

### ui/
| Fișier | Descriere |
|--------|-----------|
| `src/lib/design-tokens.ts` | Variabile CSS: `--agri-primary`, `--agri-border`, etc. |
| `src/lib/ui/status-badges.ts` | Hartă stilizare status → culori/label |

### Root lib files
| Fișier | Descriere |
|--------|-----------|
| `src/lib/query-keys.ts` ⭐ | Toate cheile React Query centralizate |
| `src/lib/utils.ts` | Utilitare generale (cn, etc.) |
| `src/proxy.ts` ⭐ | Middleware: validare sesiune, rezolvare tenant, injectare headere |

---

## src/hooks/
| Fișier | Descriere |
|--------|-----------|
| `src/hooks/useBodyScrollLock.ts` | Lock/unlock scroll body |
| `src/hooks/useDemoBannerVisible.ts` | Stare vizibilitate banner demo |
| `src/hooks/useUiDensity.ts` | Acces context densitate UI |

---

## src/contexts/
| Fișier | Descriere |
|--------|-----------|
| `src/contexts/AddActionContext.tsx` ⭐ | Context înregistrare acțiune FAB per pagină |

---

## src/types/
| Fișier | Descriere |
|--------|-----------|
| `src/types/supabase.ts` ⭐ | Tipuri TypeScript generate din schema Supabase |

---

## supabase/
| Director | Descriere |
|----------|-----------|
| `supabase/migrations/` | 96 migrații SQL în ordine cronologică |
| `supabase/config.toml` | Configurare Supabase CLI |

---

## Root config files
| Fișier | Descriere |
|--------|-----------|
| `vercel.json` ⭐ | Configurare Vercel: cron jobs (18:00, 03:00, 04:00 UTC) |
| `next.config.js` | Configurare Next.js (webpack, env) |
| `check-env.js` | Validare variabile de mediu înainte de build |
| `tailwind.config.ts` | Configurare TailwindCSS 4 |
| `tsconfig.json` | Configurare TypeScript |
| `package.json` | Dependențe și scripturi |
| `CLAUDE.md` ⭐ | Instrucțiuni pentru Claude Code |
