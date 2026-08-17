import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { api } from '../api/client';
import { useAuth } from '../state/auth';
import { IslandMark } from '../components/Logo';
import { Dropdown, type Option } from '../components/Dropdown';
import { IconEye, IconEyeOff } from '../components/icons';
import { phraseForDate } from '../lib/phrases';
import { cx, isoDate } from '../lib/util';

type Mode = 'login' | 'signup' | 'recover';

const QUESTIONS = [
  '¿Cómo se llamaba tu primera mascota?',
  '¿En qué ciudad naciste?',
  '¿Cuál es el nombre de tu mejor amigo de la infancia?',
  '¿Cuál era tu comida favorita de niño?',
  '¿Cómo se llamaba tu primer colegio?',
];
const QUESTION_OPTIONS: Option[] = [
  ...QUESTIONS.map((q) => ({ value: q, label: q })),
  { value: '__custom__', label: 'Escribir mi propia pregunta...' },
];

const ease = [0.4, 0, 0.2, 1] as const;

export function AuthScreen() {
  const { login, signup, resetWithAnswer } = useAuth();
  const [view, setView] = useState<Mode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [question, setQuestion] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [recoverStep, setRecoverStep] = useState<'email' | 'answer'>('email');
  const [recoverQuestion, setRecoverQuestion] = useState('');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Transicion entre vistas: la ola sube (cubre), cambia la vista, y baja.
  const wave = useAnimationControls();
  const animating = useRef(false);

  const go = async (to: Mode) => {
    if (animating.current || to === view) return;
    animating.current = true;
    setError('');
    await wave.start({ y: '0%', transition: { duration: 0.5, ease } });
    setView(to);
    setRecoverStep('email');
    await new Promise((r) => setTimeout(r, 80));
    await wave.start({ y: '116%', transition: { duration: 0.5, ease } });
    animating.current = false;
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (view === 'login') {
        await login(email, password);
      } else if (view === 'signup') {
        if (!question) throw new Error('Elige una pregunta de seguridad');
        const q = question === '__custom__' ? customQuestion.trim() : question;
        if (!q) throw new Error('Escribe tu pregunta de seguridad');
        await signup({ email, password, name, securityQuestion: q, securityAnswer: answer });
      } else if (recoverStep === 'email') {
        const { question } = await api.auth.recoverQuestion(email.trim().toLowerCase());
        setRecoverQuestion(question);
        setRecoverStep('answer');
      } else {
        await resetWithAnswer(email, answer, newPassword);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Inicia el flujo de Google (redirección al servidor -> Google -> callback).
  function onGoogle() {
    window.location.href = '/auth/google';
  }

  // Si el callback de Google volvió con error, mostrarlo y limpiar la URL.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('auth');
    if (reason && reason.startsWith('google')) {
      setError('No se pudo iniciar sesión con Google. Inténtalo de nuevo.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const errorBox = error ? (
    <p className="rounded-xl px-3.5 py-2.5 text-center text-sm font-medium" style={{ background: 'rgba(239,68,68,.12)', color: '#ef4444' }}>
      {error}
    </p>
  ) : null;

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: 'var(--surface)' }}>
      <Decor />

      {/* ── LOGIN ── */}
      {view === 'login' && (
        <div className="absolute inset-0 flex">
          <BrandHalf title="Holm" tagline="Tu espacio, a tu manera." />
          <FormHalf>
            <Heading title="Bienvenido de vuelta" subtitle="Entra para seguir donde lo dejaste." />
            <form onSubmit={submit} className="mt-7 space-y-5" autoComplete="off">
              <Field label="Email" value={email} onChange={setEmail} type="email" autoFocus />
              <Field label="Contraseña" value={password} onChange={setPassword} type="password" />
              <div className="flex justify-center">
                <TextBtn onClick={() => go('recover')}>Olvidé mi contraseña</TextBtn>
              </div>
              {errorBox}
              <SubmitBtn busy={busy} label="Entrar" />
              <OrDivider />
              <GoogleBtn onClick={onGoogle} label="Continuar con Google" />
            </form>
            <Switcher>
              ¿No tienes cuenta? <Link onClick={() => go('signup')}>Crear una</Link>
            </Switcher>
          </FormHalf>
        </div>
      )}

      {/* ── CREAR CUENTA · espejo ── */}
      {view === 'signup' && (
        <div className="absolute inset-0 flex md:flex-row-reverse">
          <BrandHalf title="Únete a Holm" tagline="Crea tu isla y empieza a ordenar lo tuyo." />
          <FormHalf>
            <Heading title="Crea tu cuenta" subtitle="Una cuenta, tu propio espacio." />
            <form onSubmit={submit} className="mt-7 space-y-4" autoComplete="off">
              <Field label="Tu nombre" value={name} onChange={setName} autoFocus />
              <Field label="Email" value={email} onChange={setEmail} type="email" />
              <Field label="Contraseña" value={password} onChange={setPassword} type="password" />
              <div className="text-left">
                <Label center>Pregunta de seguridad</Label>
                <Dropdown value={question} options={QUESTION_OPTIONS} onChange={setQuestion} />
              </div>
              {question === '__custom__' && <Field label="Tu pregunta" value={customQuestion} onChange={setCustomQuestion} />}
              <Field label="Respuesta secreta" value={answer} onChange={setAnswer} />
              {errorBox}
              <SubmitBtn busy={busy} label="Crear cuenta" />
              <OrDivider />
              <GoogleBtn onClick={onGoogle} label="Registrarme con Google" />
            </form>
            <Switcher>
              ¿Ya tienes cuenta? <Link onClick={() => go('login')}>Inicia sesión</Link>
            </Switcher>
          </FormHalf>
        </div>
      )}

      {/* ── RECUPERAR ── */}
      {view === 'recover' && (
        <div className="absolute inset-0 flex">
          <div className="relative z-10 hidden w-1/2 flex-col items-center justify-center px-12 text-center md:flex">
            <div className="animFloat">
              <IslandBadge size={132} />
            </div>
            <h1 className="mt-8 text-[2.6rem] font-bold leading-none tracking-tight" style={{ color: 'var(--text)' }}>
              Recupera tu acceso
            </h1>
            <p className="mt-5 max-w-sm text-base" style={{ color: 'var(--text-soft)' }}>
              Sin correos ni esperas: respondes tu pregunta de seguridad y eliges una contraseña nueva al instante.
            </p>
            <div className="mt-8 space-y-3 text-left">
              <StepRow n={1} label="Confirma tu email" on={true} />
              <StepRow n={2} label="Responde y cambia tu clave" on={recoverStep === 'answer'} />
            </div>
          </div>
          <FormHalf>
            <Heading
              title={recoverStep === 'email' ? 'Tu email' : 'Casi listo'}
              subtitle={recoverStep === 'email' ? 'Confirma el correo de tu cuenta.' : 'Responde y elige una nueva contraseña.'}
            />
            <AnimatePresence mode="wait" initial={false}>
              {recoverStep === 'email' ? (
                <motion.form key="r-email" onSubmit={submit} autoComplete="off" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-7 space-y-5">
                  <Field label="Email de tu cuenta" value={email} onChange={setEmail} type="email" autoFocus />
                  {errorBox}
                  <SubmitBtn busy={busy} label="Continuar" />
                </motion.form>
              ) : (
                <motion.form key="r-answer" onSubmit={submit} autoComplete="off" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-7 space-y-5">
                  <div className="rounded-xl px-4 py-3 text-center text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                    <span className="mb-0.5 block text-xs uppercase tracking-wide" style={{ color: 'var(--text-soft)' }}>
                      Tu pregunta
                    </span>
                    {recoverQuestion}
                  </div>
                  <Field label="Tu respuesta" value={answer} onChange={setAnswer} autoFocus />
                  <Field label="Nueva contraseña" value={newPassword} onChange={setNewPassword} type="password" />
                  {errorBox}
                  <SubmitBtn busy={busy} label="Cambiar contraseña" />
                </motion.form>
              )}
            </AnimatePresence>
            <Switcher>
              <Link onClick={() => go('login')}>Volver a entrar</Link>
            </Switcher>
          </FormHalf>
        </div>
      )}

      {/* olas ambientales del fondo */}
      <Waves />

      {/* ola de transicion: cubre y descubre al cambiar de vista */}
      <WaveCurtain controls={wave} />
    </div>
  );
}

/* ── transicion de ola ── */

function WaveCurtain({ controls }: { controls: ReturnType<typeof useAnimationControls> }) {
  // Varias capas de ola (de atras hacia adelante) + espuma + islitas, para que
  // la cortina no sea un solo color plano.
  const layers = [
    { d: 'M0,120 C140,38 360,38 600,82 C840,126 1060,38 1200,82 L1200,120 Z', fill: '#0a2730', ty: -96 },
    { d: 'M0,120 C170,52 380,52 600,92 C820,132 1040,52 1200,92 L1200,120 Z', fill: '#0d3a44', ty: -104 },
    { d: 'M0,120 C150,64 400,64 600,100 C800,136 1050,64 1200,100 L1200,120 Z', fill: '#157e8e', ty: -111 },
    { d: 'M0,120 C200,80 420,80 640,108 C860,136 1020,80 1200,108 L1200,120 Z', fill: '#21C2D9', ty: -117, op: 0.8 },
    { d: 'M0,120 C200,92 420,92 640,114 C860,136 1020,92 1200,114 L1200,120 Z', fill: '#C1EFF6', ty: -121, op: 0.7 },
  ];
  // Burbujas distribuidas por TODO el cuerpo: cuando la ola cubre del todo,
  // siguen viendose y no queda un color plano.
  const bubbles = [
    { l: '16%', t: '24%', s: 9, c: '#99E4F0' },
    { l: '30%', t: '52%', s: 6, c: '#C1EFF6' },
    { l: '22%', t: '78%', s: 12, c: '#49CFE4' },
    { l: '48%', t: '36%', s: 7, c: '#eafcff' },
    { l: '58%', t: '66%', s: 10, c: '#71DAEA' },
    { l: '70%', t: '28%', s: 8, c: '#C1EFF6' },
    { l: '78%', t: '58%', s: 6, c: '#99E4F0' },
    { l: '64%', t: '85%', s: 11, c: '#49CFE4' },
    { l: '40%', t: '88%', s: 7, c: '#eafcff' },
    { l: '88%', t: '40%', s: 9, c: '#71DAEA' },
  ];
  // Bandas de tono (claro arriba -> oscuro al fondo) con borde superior ondulado.
  const bands = [
    { top: '-2%', fill: '#1a8ea0' },
    { top: '20%', fill: '#13707e' },
    { top: '42%', fill: '#0f5563' },
    { top: '63%', fill: '#0c3f4a' },
    { top: '82%', fill: '#0a2c34' },
  ];
  const bandWaveA = 'M0,60 C200,18 400,18 600,38 C800,58 1000,18 1200,38 L1200,60 Z';
  const bandWaveB = 'M0,60 C200,40 420,40 600,22 C820,4 1020,44 1200,24 L1200,60 Z';
  return (
    <motion.div initial={{ y: '116%' }} animate={controls} className="pointer-events-none fixed inset-0 z-50">
      {/* cuerpo con varias bandas de tono */}
      {bands.map((b, i) => (
        <div key={i} className="absolute inset-x-0" style={{ top: b.top, bottom: 0, background: b.fill }}>
          <svg className="absolute inset-x-0 bottom-full h-10 w-full" viewBox="0 0 1200 60" preserveAspectRatio="none" fill="none">
            <path d={i % 2 ? bandWaveB : bandWaveA} fill={b.fill} />
          </svg>
        </div>
      ))}

      {/* textura del cuerpo: islas tenues, vetas y burbujas */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-[30%]" style={{ opacity: 0.1 }}>
          <IslandMark size={140} />
        </div>
        <div className="absolute right-[10%] top-[58%]" style={{ opacity: 0.08 }}>
          <IslandMark size={100} />
        </div>
        <div className="absolute left-[44%] top-[74%]" style={{ opacity: 0.07 }}>
          <IslandMark size={80} />
        </div>
        {/* vetas tipo corriente */}
        <svg className="absolute left-0 top-[38%] h-10 w-full" viewBox="0 0 1200 40" preserveAspectRatio="none" fill="none">
          <path d="M0 20 Q300 6 600 20 T1200 20" stroke="#157e8e" strokeWidth="2" opacity="0.35" />
        </svg>
        <svg className="absolute left-0 top-[62%] h-10 w-full" viewBox="0 0 1200 40" preserveAspectRatio="none" fill="none">
          <path d="M0 20 Q300 34 600 20 T1200 20" stroke="#1BA1B6" strokeWidth="2" opacity="0.3" />
        </svg>
        {bubbles.map((b, i) => (
          <div
            key={i}
            className="animFloat absolute rounded-full"
            style={{ left: b.l, top: b.t, width: b.s, height: b.s, background: b.c, opacity: 0.45, animationDuration: `${6 + (i % 4)}s`, animationDelay: `${(i % 5) * 0.3}s` }}
          />
        ))}
      </div>

      {/* islitas que flotan sobre la cresta */}
      <div className="absolute left-[18%] top-0 -translate-y-[150%]">
        <IslandMark size={56} />
      </div>
      <div className="absolute right-[22%] top-0 -translate-y-[185%]">
        <IslandMark size={40} />
      </div>
      {/* espuma sobre la cresta */}
      <div className="absolute left-[40%] top-0 h-2.5 w-2.5 -translate-y-[230%] rounded-full" style={{ background: '#eafcff', opacity: 0.85 }} />
      <div className="absolute left-[55%] top-0 h-1.5 w-1.5 -translate-y-[300%] rounded-full" style={{ background: '#C1EFF6', opacity: 0.8 }} />
      <div className="absolute left-[68%] top-0 h-2 w-2 -translate-y-[210%] rounded-full" style={{ background: '#eafcff', opacity: 0.8 }} />
      <div className="absolute left-[30%] top-0 h-1.5 w-1.5 -translate-y-[260%] rounded-full" style={{ background: '#99E4F0', opacity: 0.8 }} />

      {/* capas de ola en la cresta */}
      {layers.map((l, i) => (
        <svg key={i} className="absolute left-0 top-0 h-24 w-full" style={{ transform: `translateY(${l.ty}%)` }} viewBox="0 0 1200 120" preserveAspectRatio="none" fill="none">
          <path d={l.d} fill={l.fill} opacity={l.op ?? 1} />
        </svg>
      ))}
    </motion.div>
  );
}

/* ── decoracion ── */

function Decor() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <FloatBox cls="left-[4%] top-[10%]" dur="8s">
        <IslandMark size={150} className="opacity-[0.06]" />
      </FloatBox>
      <FloatBox cls="right-[5%] top-[16%]" dur="9.5s" delay="0.8s">
        <IslandMark size={120} className="opacity-[0.05]" />
      </FloatBox>
      <FloatBox cls="left-[12%] bottom-[26%]" dur="7.5s" delay="1.4s">
        <IslandMark size={84} className="opacity-[0.05]" />
      </FloatBox>
      <Dot cls="left-[20%] top-[22%]" size={10} color="#49CFE4" dur="6s" />
      <Dot cls="left-[8%] top-[44%]" size={6} color="#71DAEA" dur="7s" delay="1s" />
      <Dot cls="right-[16%] top-[34%]" size={12} color="#21C2D9" dur="8s" delay="0.5s" />
      <Dot cls="right-[26%] bottom-[30%]" size={7} color="#99E4F0" dur="6.5s" delay="1.2s" />
      <Dot cls="left-[40%] top-[12%]" size={8} color="#1BA1B6" dur="9s" delay="0.3s" />
      <Dot cls="right-[40%] bottom-[40%]" size={9} color="#49CFE4" dur="7.8s" delay="0.9s" />
    </div>
  );
}

function FloatBox({ cls, dur, delay, children }: { cls: string; dur: string; delay?: string; children: ReactNode }) {
  return (
    <div className={`animFloat absolute ${cls}`} style={{ animationDuration: dur, animationDelay: delay ?? '0s' }}>
      {children}
    </div>
  );
}

function Dot({ cls, size, color, dur, delay }: { cls: string; size: number; color: string; dur: string; delay?: string }) {
  return (
    <div
      className={`animFloat absolute rounded-full ${cls}`}
      style={{ width: size, height: size, background: color, opacity: 0.5, animationDuration: dur, animationDelay: delay ?? '0s' }}
    />
  );
}

/* ── piezas ── */

function IslandBadge({ size = 150, island }: { size?: number; island?: number }) {
  const mark = island ?? Math.round(size * 0.74);
  return (
    <div className="flex items-center justify-center rounded-full" style={{ width: size, height: size, background: 'var(--surface-3)' }}>
      {/* el motivo pesa arriba (sol) y sus olas se dibujan altas: lo bajo ~5% para centrarlo óptico */}
      <IslandMark size={mark} className="translate-y-[6%]" />
    </div>
  );
}

function BrandHalf({ title, tagline }: { title: string; tagline: string }) {
  return (
    <div className="relative z-10 hidden w-1/2 flex-col items-center justify-center px-12 text-center md:flex">
      <div className="animFloat">
        <IslandBadge />
      </div>
      <h1 className="mt-8 text-[3rem] font-bold leading-none tracking-tight" style={{ color: 'var(--text)' }}>
        {title}
      </h1>
      <p className="mt-5 max-w-xs text-xl font-semibold leading-snug" style={{ color: 'var(--text)' }}>
        {tagline}
      </p>
      <p className="mt-3 max-w-xs text-sm" style={{ color: 'var(--text-soft)' }}>
        {phraseForDate(isoDate())}
      </p>
      <div className="mt-7 flex items-center gap-2 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-soft)' }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#21C2D9' }} />
        Tareas · Notas · Ideas · Hábitos
      </div>
    </div>
  );
}

function FormHalf({ children }: { children: ReactNode }) {
  return (
    <main className="relative z-10 flex w-full items-center justify-center overflow-auto px-8 py-10 md:w-1/2">
      <div className="w-full max-w-sm text-center">
        <div className="mb-7 flex justify-center md:hidden">
          <IslandBadge size={72} />
        </div>
        {children}
      </div>
    </main>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
        {title}
      </h2>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-soft)' }}>
        {subtitle}
      </p>
    </div>
  );
}

function StepRow({ n, label, on }: { n: number; label: string; on: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold"
        style={on ? { background: '#21C2D9', color: '#06141a' } : { background: 'var(--surface-3)', color: 'var(--text-soft)' }}
      >
        {n}
      </span>
      <span className="text-sm font-medium" style={{ color: on ? 'var(--text)' : 'var(--text-soft)' }}>
        {label}
      </span>
    </div>
  );
}

function SubmitBtn({ busy, label }: { busy: boolean; label: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      type="submit"
      disabled={busy}
      className="w-full rounded-full bg-accent-500 py-3.5 text-base font-semibold text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
    >
      {busy ? 'Un momento...' : label}
    </motion.button>
  );
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3" style={{ color: 'var(--text-soft)' }}>
      <span className="h-px flex-1" style={{ background: 'var(--surface-3)' }} />
      <span className="text-xs uppercase tracking-wide">o</span>
      <span className="h-px flex-1" style={{ background: 'var(--surface-3)' }} />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function GoogleBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-3 rounded-full py-3.5 text-base font-semibold transition-colors hover:bg-[var(--surface-3)]"
      style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
    >
      <GoogleIcon /> {label}
    </motion.button>
  );
}

function Switcher({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-soft)' }}>
      {children}
    </p>
  );
}

function Link({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="font-semibold underline-offset-4 transition hover:underline" style={{ color: 'var(--text)' }}>
      {children}
    </button>
  );
}

function TextBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm underline-offset-4 transition-colors hover:text-[var(--text)] hover:underline"
      style={{ color: 'var(--text-soft)' }}
    >
      {children}
    </button>
  );
}

function Label({ children, center }: { children: ReactNode; center?: boolean }) {
  return (
    <label className={`mb-1.5 block text-xs font-medium uppercase tracking-wide ${center ? 'text-center' : ''}`} style={{ color: 'var(--text-soft)' }}>
      {children}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPw = type === 'password';
  const inputType = isPw ? (show ? 'text' : 'password') : type;
  return (
    <div className="w-full">
      <Label center>{label}</Label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          autoComplete="off"
          className={cx('afield text-center text-base', isPw && 'px-11')}
        />
        {isPw && (
          <motion.button
            type="button"
            onClick={() => setShow((s) => !s)}
            tabIndex={-1}
            whileTap={{ scale: 0.82 }}
            title={show ? 'Ocultar' : 'Mostrar'}
            className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center overflow-hidden rounded-lg transition-colors hover:text-[var(--text)]"
            style={{ color: 'var(--text-soft)' }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={show ? 'off' : 'on'}
                initial={{ opacity: 0, scaleY: 0.2 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0.2 }}
                transition={{ duration: 0.14, ease }}
                className="grid place-items-center"
              >
                {show ? <IconEyeOff width={18} height={18} /> : <IconEye width={18} height={18} />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        )}
      </div>
    </div>
  );
}

function Waves() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-48 overflow-hidden">
      <div className="animFloat absolute bottom-24 left-[30%] h-2 w-2 rounded-full" style={{ background: '#49CFE4', opacity: 0.5, animationDuration: '6s' }} />
      <div className="animFloat absolute bottom-28 left-[60%] h-1.5 w-1.5 rounded-full" style={{ background: '#71DAEA', opacity: 0.5, animationDuration: '7s', animationDelay: '1s' }} />
      <div className="animFloat absolute bottom-20 left-[80%] h-2.5 w-2.5 rounded-full" style={{ background: '#21C2D9', opacity: 0.4, animationDuration: '8s', animationDelay: '.5s' }} />
      <svg className="animWave absolute bottom-9 h-28 w-[200%]" viewBox="0 0 1200 120" preserveAspectRatio="none" fill="none">
        <path d="M0 60 Q150 20 300 60 T600 60 T900 60 T1200 60 V120 H0 Z" fill="#0d2b33" opacity="0.45" />
      </svg>
      <svg className="animWave absolute bottom-3 h-28 w-[200%]" style={{ animationDuration: '20s' }} viewBox="0 0 1200 120" preserveAspectRatio="none" fill="none">
        <path d="M0 60 Q150 100 300 60 T600 60 T900 60 T1200 60 V120 H0 Z" fill="#103a44" opacity="0.6" />
      </svg>
      <svg className="animWave absolute bottom-0 h-28 w-[200%]" style={{ animationDuration: '26s' }} viewBox="0 0 1200 120" preserveAspectRatio="none" fill="none">
        <path d="M0 70 Q200 40 400 70 T800 70 T1200 70 V120 H0 Z" fill="#21C2D9" opacity="0.16" />
      </svg>
    </div>
  );
}
