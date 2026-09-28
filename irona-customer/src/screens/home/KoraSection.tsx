import koraPhoto from '@/assets/images/Tak berjudul33_20260725035338.png';
import { KORA_INSTAGRAM_URL, KORA_TRAITS } from '@/constants/kora';
import { cn } from '@/lib/utils';
import { ctaClass } from './HeroSection';

/** Mockup statis: heading ikut "Yuk Nongkrong", paragraf ikut deskripsi Hero, CTA ikut "Kunjungi kami" */
export default function KoraSection() {
  return (
    <section id="kora" className="scroll-mt-[60px] border-b border-dashed border-foreground">
      <div className="mx-auto max-w-[1200px] px-4 pt-[18px] pb-7 md:px-[30px]">
        <h2 className="pl-0.5 font-display text-2xl leading-[22px]">Kenalan sama Kora</h2>

        <div className="mt-4 grid items-center gap-4 md:grid-cols-2">
          <img
            src={koraPhoto}
            alt="Kora, maskot Toko Kopi Irona, melambai sambil memegang kopi"
            className="w-full max-w-[360px]"
          />

          {/* DRAFT: copy masih draft, review ulang dengan tim kreatif */}
          <div className="pl-0.5">
            <p className="max-w-[453px] text-[13px] leading-6 md:text-sm">
              Kora si koala barista yang jaga Irona sejak hari pertama. Kerjanya nyeduh kopi, nyapa
              pelanggan, dan sesekali ketiduran di balik meja bar. Kalau mampir, jangan lupa bilang
              halo ya!
            </p>
            <ul className="mt-2 list-inside list-disc text-[13px] leading-6 md:text-sm">
              {KORA_TRAITS.map((trait) => (
                <li key={trait}>{trait}</li>
              ))}
            </ul>
            <a
              href={KORA_INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className={cn(ctaClass, 'mt-3.5 inline-grid bg-background hover:bg-secondary')}
            >
              Ikuti Kora di Instagram
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
