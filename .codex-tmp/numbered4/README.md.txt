1	# 🍓 Zmeurel OS - ERP Agricol pentru Plantații Zmeură & Mure
2	
3	**Aplicație ERP specializată** pentru managementul plantațiilor de zmeură și mure, cu focus pe tracking operațiuni zilnice, profitabilitate, și conformitate legală.
4	
5	---
6	
7	## 📊 STATUS PROIECT
8	
9	**Progres MVP:** ~40% complet  
10	**Ultima actualizare:** 12 Februarie 2026  
11	
12	### ✅ **Module funcționale:**
13	- **Parcele** - CRUD complet (Create, Read, Update, Delete) ✅
14	- **Authentication** - Supabase Auth cu RLS policies ✅
15	- **Database** - 11 tabele cu multi-tenant architecture ✅
16	
17	### 🚧 **În dezvoltare:**
18	- Clienți, Culegători (next up)
19	- Recoltări, Vânzări
20	- Dashboard cu KPIs
21	
22	---
23	
24	## 🚀 QUICK START
25	
26	### **Prerequisites:**
27	
28	- Node.js 18+ (https://nodejs.org)
29	- Git (https://git-scm.com)
30	- Cont Supabase (https://supabase.com)
31	- Editor: VS Code sau Cursor (recomandat)
32	
33	---
34	
35	### **1. Clone repository:**
36	
37	```bash
38	git clone https://github.com/zmeurelOS-admin/zmeurel-os.git
39	cd zmeurel-os
40	```
41	
42	---
43	
44	### **2. Install dependencies:**
45	
46	```bash
47	npm install
48	```
49	
50	**Pachete principale:**
51	- Next.js 16.1.6 (Turbopack)
52	- @supabase/ssr
53	- @tanstack/react-query
54	- shadcn/ui components
55	- Tailwind CSS v4 alpha
56	
57	---
58	
59	### **3. Configure environment variables:**
60	
61	Creează fișier `.env.local` în root:
62	
63	```env
64	NEXT_PUBLIC_SUPABASE_URL=https://ilybohhdeplwcrbpblqw.supabase.co
65	NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
66	```
67	
68	**⚠️ Obține credențiale din:**
69	- Supabase Dashboard → Settings → API
70	- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
71	- **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
72	
73	---
74	
75	### **4. Start development server:**
76	
77	```bash
78	npm run dev
79	```
80	
81	**Aplicația va rula pe:** http://localhost:3000
82	
83	---
84	
85	### **5. Access aplicația:**
86	
87	**Login:**
88	- Email: popa.andrei.sv@gmail.com
89	- Password: [solicită la developer]
90	
91	**Primera pagină:** http://localhost:3000/parcele
92	
93	---
94	
95	## 🗄️ DATABASE SETUP
96	
97	### **Schema SQL (Supabase):**
98	
99	**Rulează în SQL Editor (Supabase Dashboard):**
100	
101	```sql
102	-- Creare tabele (vezi schema completă în documentație)
103	
104	-- Populare nomenclatoare cu soiuri:
105	INSERT INTO nomenclatoare (tip, valoare, descriere) VALUES
106	('Soi', 'Polka', 'Zmeură remontantă, producție iulie-septembrie'),
107	('Soi', 'Tulameen', 'Zmeură neremontantă, producție iunie-iulie'),
108	('Soi', 'Heritage', 'Zmeură remontantă, producție toamnă'),
109	('Soi', 'Loch Ness', 'Mure fără spini, producție iulie-august'),
110	('Soi', 'Chester', 'Mure fără spini, producție târzie august-septembrie');
111	```
112	
113	**RLS Policies:**
114	```sql
115	-- Tenant isolation (users văd doar datele lor)
116	CREATE POLICY "tenant_isolation" ON parcele
117	FOR SELECT
118	USING (
119	  tenant_id IN (
120	    SELECT id FROM tenants 
121	    WHERE owner_user_id = auth.uid()
122	  )
123	);
124	```
125	
126	---
127	
128	## 📂 PROJECT STRUCTURE
129	
130	```
131	zmeurel/
132	├── app/
133	│   ├── (auth)/              # Authentication pages
134	│   │   ├── login/
135	│   │   └── register/
136	│   ├── (dashboard)/         # Main app
137	│   │   ├── layout.tsx       # Dashboard layout + Providers
138	│   │   ├── providers.tsx    # QueryClient + Toaster
139	│   │   └── parcele/         # ✅ Parcele module (CRUD)
140	│   │       ├── page.tsx
141	│   │       └── ParcelaPageClient.tsx
142	│   ├── globals.css
143	│   └── layout.tsx
144	├── components/
145	│   ├── ui/                  # shadcn/ui components
146	│   │   ├── button.tsx
147	│   │   ├── card.tsx
148	│   │   ├── dialog.tsx
149	│   │   ├── input.tsx
150	│   │   └── ...
151	│   └── parcele/             # Parcele-specific components
152	│       ├── ParcelaCard.tsx
153	│       ├── AddParcelaDialog.tsx
154	│       ├── EditParcelaDialog.tsx
155	│       └── DeleteConfirmDialog.tsx
156	├── lib/
157	│   ├── supabase/
158	│   │   ├── client.ts        # Browser Supabase client
159	│   │   ├── server.ts        # Server Supabase client
160	│   │   └── queries/
161	│   │       └── parcele.ts   # CRUD operations
162	│   └── utils.ts
163	├── .env.local               # Environment variables (NOT in git)
164	├── package.json
165	└── README.md
166	```
167	
168	---
169	
170	## 🎨 TECH STACK
171	
172	### **Frontend:**
173	- **Framework:** Next.js 16.1.6 (App Router + Turbopack)
174	- **Language:** TypeScript
175	- **Styling:** Tailwind CSS v4 alpha
176	- **UI Components:** shadcn/ui (Radix UI primitives)
177	- **State Management:** TanStack Query (React Query v5)
178	- **Forms:** React Hook Form + Zod validation
179	- **Icons:** Lucide React
180	
181	### **Backend:**
182	- **Database:** Supabase PostgreSQL
183	- **Auth:** Supabase Auth
184	- **Storage:** Supabase Storage (pentru facturi/documente)
185	- **Realtime:** Supabase Realtime (sync multi-device)
186	
187	### **Deployment:**
188	- **Frontend:** Vercel (zmeurel.ro)
189	- **Backend:** Supabase Cloud
190	- **CI/CD:** GitHub Actions (planned)
191	
192	---
193	
194	## 🔐 AUTHENTICATION & SECURITY
195	
196	**Authentication:**
197	- Email/Password (Supabase Auth)
198	- Google OAuth (planned)
199	
200	**Security:**
201	- Row Level Security (RLS) on all tables
202	- Multi-tenant isolation (tenant_id filtering)
203	- Server-side validation
204	- Environment variables for secrets
205	
206	**User roles (planned):**
207	- Owner (full access)
208	- Admin (manage all data)
209	- Operator (limited access)
210	
211	---
212	
213	## 🛠️ DEVELOPMENT WORKFLOW
214	
215	### **Branching strategy:**
216	
217	```bash
218	main         # Production (auto-deploy Vercel)
219	develop      # Staging
220	feature/*    # Feature branches → PR → develop
221	```
222	
223	### **Commit messages:**
224	
225	```bash
226	feat: Add clienți CRUD module
227	fix: Recoltari calculation bug
228	docs: Update README
229	style: Format with Prettier
230	```
231	
232	### **Testing:**
233	
234	```bash
235	# Unit tests (planned):
236	npm test
237	
238	# E2E tests (planned):
239	npm run test:e2e
240	
241	# Linting:
242	npm run lint
243	```
244	
245	---
246	
247	## 📚 AVAILABLE SCRIPTS
248	
249	```bash
250	# Development:
251	npm run dev              # Start dev server (localhost:3000)
252	
253	# Build:
254	npm run build            # Production build
255	npm run start            # Start production server
256	
257	# Code quality:
258	npm run lint             # ESLint
259	npm run format           # Prettier format
260	npm run type-check       # TypeScript check
261	```
262	
263	---
264	
265	## 🐛 DEBUGGING & TROUBLESHOOTING
266	
267	### **Common issues:**
268	
269	**1. Module not found errors:**
270	```bash
271	# Clear cache and reinstall:
272	rm -rf node_modules .next
273	npm install
274	```
275	
276	**2. Supabase connection errors:**
277	- Check `.env.local` has correct credentials
278	- Verify Supabase project is running
279	- Test connection: http://localhost:3000/test-supabase (if page exists)
280	
281	**3. Tailwind CSS not working:**
282	- Clear Turbopack cache: Delete `.next` folder
283	- Restart dev server
284	
285	**4. TypeScript errors:**
286	```bash
287	npm run type-check
288	```
289	
290	### **Debug tools:**
291	
292	**Browser DevTools (F12):**
293	- Console tab → JavaScript errors
294	- Network tab → API calls
295	- React DevTools extension
296	
297	**Terminal logs:**
298	- All Supabase queries logged with 🔍 emoji
299	- Errors logged with ❌ emoji
300	
301	---
302	
303	## 📖 DOCUMENTATION
304	
305	**Full documentation:**
306	- `PROGRES.md` - Detailed development progress log
307	- `BACKUP-INSTRUCTIONS.md` - Backup and recovery guide
308	- Supabase docs: https://supabase.com/docs
309	- Next.js docs: https://nextjs.org/docs
310	
311	---
312	
313	## 🤝 CONTRIBUTING
314	
315	**Acest proiect este personal momentan.**
316	
317	Dacă vrei să contribui în viitor:
318	1. Fork repository
319	2. Create feature branch (`git checkout -b feature/amazing-feature`)
320	3. Commit changes (`git commit -m 'Add amazing feature'`)
321	4. Push to branch (`git push origin feature/amazing-feature`)
322	5. Open Pull Request
323	
324	---
325	
326	## 📞 SUPPORT
327	
328	**Developer:** Popa Andrei  
329	**Email:** popa.andrei.sv@gmail.com  
330	**GitHub:** https://github.com/zmeurelOS-admin/zmeurel-os
331	
332	**AI Assistant:** Claude (Anthropic)
333	
334	---
335	
336	## 📄 LICENSE
337	
338	**Proprietar / Private** (momentan)
339	
340	Planificat pentru viitor: MIT License când devine open-source / SaaS public.
341	
342	---
343	
344	## 🎯 ROADMAP
345	
346	### **Q1 2026 (Febr-Mar) - MVP Core:**
347	- [x] Setup proiect + Supabase
348	- [x] Authentication system
349	- [x] Modul Parcele (CRUD complet) ✅
350	- [ ] Module CRUD simple: Clienți, Culegători
351	- [ ] Module complexe: Recoltări, Vânzări
352	- [ ] Dashboard basic cu KPIs
353	
354	### **Q2 2026 (Apr-Jun) - Feature Completeness:**
355	- [ ] Activități Agricole (tratamente, timp pauză)
356	- [ ] Investiții și Cheltuieli
357	- [ ] Vânzări Butași
358	- [ ] Upload facturi (Supabase Storage)
359	- [ ] Export rapoarte (PDF, Excel)
360	
361	### **Q3 2026 (Jul-Sep) - Polish & Testing:**
362	- [ ] UI Polish (branding Zmeurel)
363	- [ ] PWA (offline mode)
364	- [ ] Multi-user support
365	- [ ] Beta testing (5-10 fermieri)
366	
367	### **Q4 2026 (Oct-Dec) - Public Launch:**
368	- [ ] Landing page (zmeurel.ro)
369	- [ ] Pricing tiers (Freemium, Starter, Pro)
370	- [ ] Stripe integration
371	- [ ] Marketing & SEO
372	
373	---
374	
375	## 🏆 ACHIEVEMENTS
376	
377	**Sesiunea 12 Februarie 2026:**
378	- ✅ Modul Parcele 100% funcțional
379	- ✅ Supabase @supabase/ssr migration complete
380	- ✅ Dialog system cu backdrop fix (Tailwind v4 workaround)
381	- ✅ Native select dropdown working
382	- ✅ Delete/Edit operations smooth
383	- ✅ Auto-generated IDs (P001, P002...)
384	- ✅ Multi-tenant architecture active
385	
386	**Progress:** 35% → 40% MVP ⬆️
387	
388	---
389	
390	## 💡 FUN FACTS
391	
392	**Numele "Zmeurel"** vine de la:
393	- 🍓 **Zmeură** (românește) = Raspberry (engleza)
394	- **-el** suffix = diminutiv afectuos (ca "căsuță", "iepuraș")
395	
396	**Logo:** 🍓 (emoji zmeură până la design final)
397	
398	**Culori branded:**
399	- Primary: #F16B6B (Bittersweet)
400	- Secondary: #312E3F (Charade)
401	
402	---
403	
404	**De la fermă la digital - Zmeurel OS! 🍓💻✨**
405	
406	*Built with ❤️ și foarte mult debugging în Suceava, România*
407	
408	---
409	
410	## Supabase PostgREST schema cache
411	
412	Dupa migrari care adauga/renumesc coloane, daca apare eroare de tip `schema cache`, ruleaza in Supabase SQL Editor:
413	
414	```sql
415	SELECT pg_notify('pgrst', 'reload schema');
416	```
