'use client'

import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ASSOCIATION_DAY_IDS,
  ASSOCIATION_DAY_LABELS,
  type AssociationPublicSettings,
  buildAssociationMarketLine,
  formatAssociationActiveDays,
  formatAssociationDeliveryDays,
} from '@/lib/association/public-settings'
import { toast } from '@/lib/ui/toast'

const PUBLIC_LINK_PATH = '/magazin/asociatie'

type Props = {
  initialSettings: AssociationPublicSettings
}

export function AssociationSettingsClient({ initialSettings }: Props) {
  const [description, setDescription] = useState(initialSettings.description)
  const [facebookUrl, setFacebookUrl] = useState(initialSettings.facebookUrl)
  const [instagramUrl, setInstagramUrl] = useState(initialSettings.instagramUrl)
  const [marketSchedule, setMarketSchedule] = useState(initialSettings.marketSchedule)
  const [marketLocation, setMarketLocation] = useState(initialSettings.marketLocation)
  const [activeDays, setActiveDays] = useState(initialSettings.activeDays)
  const [marketStartTime, setMarketStartTime] = useState(initialSettings.marketStartTime)
  const [marketEndTime, setMarketEndTime] = useState(initialSettings.marketEndTime)
  const [marketNote, setMarketNote] = useState(initialSettings.marketNote)
  const [merchantLegalName, setMerchantLegalName] = useState(initialSettings.merchantLegalName)
  const [merchantLegalForm, setMerchantLegalForm] = useState(initialSettings.merchantLegalForm)
  const [merchantCui, setMerchantCui] = useState(initialSettings.merchantCui)
  const [merchantHeadquarters, setMerchantHeadquarters] = useState(initialSettings.merchantHeadquarters)
  const [merchantEmail, setMerchantEmail] = useState(initialSettings.merchantEmail)
  const [merchantPhone, setMerchantPhone] = useState(initialSettings.merchantPhone)
  const [orderPhone, setOrderPhone] = useState(initialSettings.orderPhone)
  const [merchantRegistryNumber, setMerchantRegistryNumber] = useState(initialSettings.merchantRegistryNumber)
  const [merchantContactPerson, setMerchantContactPerson] = useState(initialSettings.merchantContactPerson)
  const [merchantDeliveryPolicy, setMerchantDeliveryPolicy] = useState(initialSettings.merchantDeliveryPolicy)
  const [merchantComplaintsPolicy, setMerchantComplaintsPolicy] = useState(initialSettings.merchantComplaintsPolicy)
  const [deliveryDays, setDeliveryDays] = useState(initialSettings.deliveryDays)
  const [deliveryCutoffText, setDeliveryCutoffText] = useState(initialSettings.deliveryCutoffText)
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(initialSettings.updatedAt)

  const absolutePublicLink =
    typeof window === 'undefined' ? PUBLIC_LINK_PATH : `${window.location.origin}${PUBLIC_LINK_PATH}`

  const previewLine = useMemo(
    () =>
      buildAssociationMarketLine({
        ...initialSettings,
        description,
        facebookUrl,
        instagramUrl,
        marketSchedule,
        marketLocation,
        activeDays,
        marketStartTime,
        marketEndTime,
        marketNote,
        merchantLegalName,
        merchantLegalForm,
        merchantCui,
        merchantHeadquarters,
        merchantEmail,
        merchantPhone,
        orderPhone,
        merchantRegistryNumber,
        merchantContactPerson,
        merchantDeliveryPolicy,
        merchantComplaintsPolicy,
        updatedAt: lastSavedAt,
      }),
    [
      activeDays,
      description,
      facebookUrl,
      instagramUrl,
      initialSettings,
      lastSavedAt,
      marketEndTime,
      marketLocation,
      marketNote,
      marketSchedule,
      marketStartTime,
      merchantCui,
      merchantComplaintsPolicy,
      merchantContactPerson,
      merchantDeliveryPolicy,
      merchantEmail,
      merchantHeadquarters,
      merchantLegalForm,
      merchantLegalName,
      merchantPhone,
      orderPhone,
      merchantRegistryNumber,
    ]
  )

  const submitSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/association/settings', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          description: description.trim(),
          facebookUrl: facebookUrl.trim(),
          instagramUrl: instagramUrl.trim(),
          marketSchedule: marketSchedule.trim(),
          marketLocation: marketLocation.trim(),
          activeDays,
          marketStartTime,
          marketEndTime,
          marketNote: marketNote.trim(),
          merchantLegalName: merchantLegalName.trim(),
          merchantLegalForm: merchantLegalForm.trim(),
          merchantCui: merchantCui.trim(),
          merchantHeadquarters: merchantHeadquarters.trim(),
          merchantEmail: merchantEmail.trim(),
          merchantPhone: merchantPhone.trim(),
          orderPhone: orderPhone.trim(),
          merchantRegistryNumber: merchantRegistryNumber.trim(),
          merchantContactPerson: merchantContactPerson.trim(),
          merchantDeliveryPolicy: merchantDeliveryPolicy.trim(),
          merchantComplaintsPolicy: merchantComplaintsPolicy.trim(),
          deliveryDays,
          deliveryCutoffText: deliveryCutoffText.trim(),
        }),
      })

      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; data?: { settings?: AssociationPublicSettings }; error?: { message?: string } }
        | null

      if (!res.ok || !json?.ok || !json.data?.settings) {
        const message = json && typeof json === 'object' && json.error?.message
        toast.error(typeof message === 'string' ? message : 'Nu am putut salva setările.')
        return
      }

      const saved = json.data.settings
      setDescription(saved.description)
      setFacebookUrl(saved.facebookUrl)
      setInstagramUrl(saved.instagramUrl)
      setMarketSchedule(saved.marketSchedule)
      setMarketLocation(saved.marketLocation)
      setActiveDays(saved.activeDays)
      setMarketStartTime(saved.marketStartTime)
      setMarketEndTime(saved.marketEndTime)
      setMarketNote(saved.marketNote)
      setMerchantLegalName(saved.merchantLegalName)
      setMerchantLegalForm(saved.merchantLegalForm)
      setMerchantCui(saved.merchantCui)
      setMerchantHeadquarters(saved.merchantHeadquarters)
      setMerchantEmail(saved.merchantEmail)
      setMerchantPhone(saved.merchantPhone)
      setOrderPhone(saved.orderPhone)
      setMerchantRegistryNumber(saved.merchantRegistryNumber)
      setMerchantContactPerson(saved.merchantContactPerson)
      setMerchantDeliveryPolicy(saved.merchantDeliveryPolicy)
      setMerchantComplaintsPolicy(saved.merchantComplaintsPolicy)
      setDeliveryDays(saved.deliveryDays)
      setDeliveryCutoffText(saved.deliveryCutoffText)
      setLastSavedAt(saved.updatedAt)
      toast.success('Setările asociației au fost actualizate.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto mt-3 w-full max-w-3xl space-y-4 pb-8 md:mt-0">
      <Card className="rounded-[22px] border-0 shadow-[var(--shadow-md)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Despre asociație</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assoc-name">Nume</Label>
            <Input id="assoc-name" value="Gustă din Bucovina" readOnly />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="assoc-description">Descriere</Label>
              <span className="text-xs text-[var(--text-secondary)]">{description.length}/1200</span>
            </div>
            <Textarea
              id="assoc-description"
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, 1200))}
              rows={5}
              placeholder="Descrierea asociației pentru pagina publică"
              maxLength={1200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assoc-facebook">Link Facebook</Label>
            <Input
              id="assoc-facebook"
              value={facebookUrl}
              onChange={(event) => setFacebookUrl(event.target.value)}
              placeholder="https://www.facebook.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assoc-instagram">Link Instagram</Label>
            <Input
              id="assoc-instagram"
              value={instagramUrl}
              onChange={(event) => setInstagramUrl(event.target.value)}
              placeholder="https://www.instagram.com/..."
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assoc-market-schedule">Program piață</Label>
              <Input
                id="assoc-market-schedule"
                value={marketSchedule}
                onChange={(event) => setMarketSchedule(event.target.value)}
                placeholder="Sâmbătă, 08:00 - 12:30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assoc-market-location">Locație piață</Label>
              <Input
                id="assoc-market-location"
                value={marketLocation}
                onChange={(event) => setMarketLocation(event.target.value)}
                placeholder="Curtea DAJ Suceava"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[22px] border-0 shadow-[var(--shadow-md)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Date comerciant (magazin public)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Afișate în footer-ul magazinului public — identitatea legală a asociației față de clienți.
          </p>
          <div className="space-y-2">
            <Label htmlFor="merchant-legal">Denumire legală</Label>
            <Input
              id="merchant-legal"
              value={merchantLegalName}
              onChange={(e) => setMerchantLegalName(e.target.value)}
              placeholder="Asociația Gustă din Bucovina"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="merchant-form">Formă juridică</Label>
              <Input
                id="merchant-form"
                value={merchantLegalForm}
                onChange={(e) => setMerchantLegalForm(e.target.value)}
                placeholder="ex. Asociație"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="merchant-cui">CUI / CIF</Label>
              <Input
                id="merchant-cui"
                value={merchantCui}
                onChange={(e) => setMerchantCui(e.target.value)}
                placeholder=""
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="merchant-registry">Nr. registru asociații</Label>
            <Input
              id="merchant-registry"
              value={merchantRegistryNumber}
              onChange={(e) => setMerchantRegistryNumber(e.target.value)}
              placeholder=""
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="merchant-hq">Sediul social</Label>
            <Textarea
              id="merchant-hq"
              value={merchantHeadquarters}
              onChange={(e) => setMerchantHeadquarters(e.target.value.slice(0, 500))}
              placeholder="Adresă completă"
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="merchant-email">Email oficial</Label>
              <Input
                id="merchant-email"
                type="email"
                value={merchantEmail}
                onChange={(e) => setMerchantEmail(e.target.value)}
                placeholder="contact@..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="merchant-phone">Telefon contact</Label>
              <Input
                id="merchant-phone"
                type="tel"
                value={merchantPhone}
                onChange={(e) => setMerchantPhone(e.target.value)}
                placeholder="07xx..."
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="merchant-order-phone">Telefon comandă</Label>
            <Input
              id="merchant-order-phone"
              type="tel"
              value={orderPhone}
              onChange={(e) => setOrderPhone(e.target.value)}
              placeholder="Număr afișat în box-ul Telefon comandă"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="merchant-contact-person">Persoană de contact</Label>
            <Input
              id="merchant-contact-person"
              value={merchantContactPerson}
              onChange={(e) => setMerchantContactPerson(e.target.value)}
              placeholder=""
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="merchant-delivery-policy">Politică livrare (rezumat)</Label>
            <Textarea
              id="merchant-delivery-policy"
              value={merchantDeliveryPolicy}
              onChange={(e) => setMerchantDeliveryPolicy(e.target.value.slice(0, 2000))}
              rows={3}
              maxLength={2000}
              placeholder="Ex.: taxe livrare, zone, program orientativ"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="merchant-complaints-policy">Politică reclamații (rezumat)</Label>
            <Textarea
              id="merchant-complaints-policy"
              value={merchantComplaintsPolicy}
              onChange={(e) => setMerchantComplaintsPolicy(e.target.value.slice(0, 2000))}
              rows={3}
              maxLength={2000}
              placeholder="Canal de contact și pași pentru reclamații"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[22px] border-0 shadow-[var(--shadow-md)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Livrări</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Zile de livrare</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ASSOCIATION_DAY_IDS.map((dayId) => {
                const checked = deliveryDays.includes(dayId)
                return (
                  <label
                    key={`delivery-${dayId}`}
                    className="flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border-default)] px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setDeliveryDays((current) => {
                          if (event.target.checked) {
                            return [...current, dayId]
                          }
                          return current.filter((item) => item !== dayId)
                        })
                      }}
                    />
                    <span>{ASSOCIATION_DAY_LABELS[dayId]}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-[var(--text-secondary)]">{formatAssociationDeliveryDays(deliveryDays)}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="assoc-delivery-cutoff">Text afișat clientului</Label>
              <span className="text-xs text-[var(--text-secondary)]">{deliveryCutoffText.length}/500</span>
            </div>
            <Textarea
              id="assoc-delivery-cutoff"
              value={deliveryCutoffText}
              onChange={(event) => setDeliveryCutoffText(event.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              placeholder="Comenzile plasate până marți la ora 14:00 se livrează miercuri."
            />
          </div>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            <p className="font-semibold text-[var(--text-primary)]">Preview client</p>
            <p className="mt-2">🚚 {deliveryCutoffText.trim() || 'Comenzile plasate până marți la ora 14:00 se livrează miercuri.'}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[22px] border-0 shadow-[var(--shadow-md)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Program piață</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Zile active</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ASSOCIATION_DAY_IDS.map((dayId) => {
                const checked = activeDays.includes(dayId)
                return (
                  <label
                    key={dayId}
                    className="flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border-default)] px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setActiveDays((current) => {
                          if (event.target.checked) {
                            return [...current, dayId]
                          }
                          return current.filter((item) => item !== dayId)
                        })
                      }}
                    />
                    <span>{ASSOCIATION_DAY_LABELS[dayId]}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-[var(--text-secondary)]">{formatAssociationActiveDays(activeDays)}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assoc-start">De la</Label>
              <Input
                id="assoc-start"
                type="time"
                value={marketStartTime}
                onChange={(event) => setMarketStartTime(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assoc-end">Până la</Label>
              <Input
                id="assoc-end"
                type="time"
                value={marketEndTime}
                onChange={(event) => setMarketEndTime(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assoc-note">Notă</Label>
            <Textarea
              id="assoc-note"
              value={marketNote}
              onChange={(event) => setMarketNote(event.target.value.slice(0, 500))}
              rows={4}
              placeholder="Info suplimentare pentru clienți"
              maxLength={500}
            />
          </div>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            <p className="font-semibold text-[var(--text-primary)]">Preview public</p>
            <p className="mt-1">{previewLine}</p>
            {marketNote.trim() ? <p className="mt-2 whitespace-pre-wrap text-xs">{marketNote.trim()}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[22px] border-0 shadow-[var(--shadow-md)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Magazin public</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
              Activ
            </Badge>
            {lastSavedAt ? (
              <span className="text-xs text-[var(--text-secondary)]">
                Ultima salvare: {new Date(lastSavedAt).toLocaleString('ro-RO')}
              </span>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="assoc-public-link">Link</Label>
            <Input id="assoc-public-link" value={PUBLIC_LINK_PATH} readOnly />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => window.open(PUBLIC_LINK_PATH, '_blank', 'noopener,noreferrer')}>
              Deschide
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(absolutePublicLink)
                toast.success('Link copiat.')
              }}
            >
              Copiază link
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" disabled={saving} onClick={() => void submitSave()}>
          {saving ? 'Se salvează…' : 'Salvează setările'}
        </Button>
      </div>
    </div>
  )
}
