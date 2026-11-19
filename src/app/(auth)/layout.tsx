// Paginile de autentificare rămân pe tema de zi indiferent de tema aleasă
// (au culori de zi scrise direct). `.theme-light` e definit în src/styles/theme.css;
// `contents` nu schimbă așezarea paginii.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="theme-light contents">{children}</div>
}
