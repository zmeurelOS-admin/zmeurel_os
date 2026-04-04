# Prompt 27 — Membri asociație (notă înainte de rulare)

**Status:** nu a fost rulat încă; aplică regulile de mai jos când implementezi invitațiile.

## Regulă de business

- **Aprobarea fermierilor** în magazinul asociației (`tenants.is_association_approved`) este decisă **doar** de superadminul Zmeurel.ro (din `/admin`, `AdminTenantsPlanTable` / `PATCH /api/admin/tenant-association`).
- **Adminul asociației** nu poate aproba sau suspenda fermieri pe `tenants`.

## Invitare membru (când vei implementa)

- La invitare, permite invitația **doar** dacă utilizatorul țintă are un tenant cu **`is_association_approved = true`**.
- Verificare: „userul are un tenant aprobat pentru asociație?”
- Dacă nu → răspuns de eroare pentru adminul asociației:  
  **„Acest fermier nu este aprobat pentru asociație. Contactați administratorul Zmeurel.ro.”**
