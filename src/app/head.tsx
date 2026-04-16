const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Zmeurel OS',
  description: 'Aplicație de gestiune agricolă pentru fermieri și asociații de producători',
  url: 'https://www.zmeurel.ro',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Android, iOS',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'RON',
    description: 'Gratuit în perioada de beta',
  },
  author: {
    '@type': 'Person',
    name: 'Andrei',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Suceava',
      addressCountry: 'RO',
    },
  },
}

export default function Head() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
    />
  )
}
