/**
 * Login pelo Firebase Authentication. A Tropa AI exige o ID token (services/coach valida o JWT);
 * as páginas de estatística são públicas. Sem usuário, a Tropa AI entra sozinha como anônimo,
 * para a banca usar sem tela de login. O Google fica como opção no avatar do header.
 *
 * Config: no Firebase Hosting vem de /__/firebase/init.json (automático). Fora dele, das variáveis
 * VITE_FIREBASE_* (.env.example). O SDK só é baixado quando o app precisa dele.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Auth, User } from 'firebase/auth';
import { registrarToken } from '../api/cliente';

type Usuario = { nome: string; foto: string | null; iniciais: string; anonimo: boolean };
type Ctx = {
  usuario: Usuario | null;
  pronto: boolean;
  disponivel: boolean;
  entrar: () => Promise<void>;
  entrarAnonimo: () => Promise<void>;
  sair: () => Promise<void>;
  token: (garantir?: boolean) => Promise<string | null>;
  erro: string | null;
};
const Contexto = createContext<Ctx | null>(null);

async function configFirebase(): Promise<Record<string, string> | null> {
  const env = import.meta.env;
  if (env.VITE_FIREBASE_API_KEY) {
    return {
      apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID,
    };
  }
  try {
    const r = await fetch('/__/firebase/init.json');
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null;
    return await r.json();
  } catch {
    return null;
  }
}

let authPromise: Promise<Auth | null> | null = null;
function obterAuth(): Promise<Auth | null> {
  authPromise ??= (async () => {
    const cfg = await configFirebase();
    if (!cfg) return null;
    try {
      const [{ initializeApp }, { getAuth }] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
      return getAuth(initializeApp(cfg));
    } catch {
      return null;
    }
  })();
  return authPromise;
}

const paraUsuario = (u: User): Usuario => {
  const nome = u.displayName || (u.isAnonymous ? 'Visitante' : 'Você');
  return { nome, foto: u.photoURL, iniciais: nome.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase(), anonimo: u.isAnonymous };
};

/** Usuário atual (esperando o Firebase restaurar a sessão salva). Com `garantir`, entra como anônimo se não houver. */
let anonimoPromise: Promise<User | null> | null = null;
async function usuarioAtual(garantir: boolean): Promise<User | null> {
  const auth = await obterAuth();
  if (!auth) return null;
  await auth.authStateReady();
  if (auth.currentUser || !garantir) return auth.currentUser;
  anonimoPromise ??= import('firebase/auth')
    .then(({ signInAnonymously }) => signInAnonymously(auth))
    .then((c) => c.user)
    .finally(() => { anonimoPromise = null; });
  return anonimoPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [pronto, setPronto] = useState(false);
  const [disponivel, setDisponivel] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let parar: (() => void) | undefined;
    obterAuth().then(async (auth) => {
      if (!auth) {
        setDisponivel(false);
        setPronto(true);
        return;
      }
      const { onAuthStateChanged } = await import('firebase/auth');
      parar = onAuthStateChanged(auth, (u) => {
        setUsuario(u ? paraUsuario(u) : null);
        setPronto(true);
      });
    });
    return () => parar?.();
  }, []);

  const token = useCallback(async (garantir = false) => {
    const u = await usuarioAtual(garantir);
    return u ? u.getIdToken() : null;
  }, []);

  const entrarAnonimo = useCallback(async () => {
    try {
      await usuarioAtual(true);
    } catch {
      setErro('Não deu para iniciar a sessão da Tropa AI. Recarregue a página.');
    }
  }, []);

  useEffect(() => registrarToken(token), [token]);

  const entrar = useCallback(async () => {
    setErro(null);
    const auth = await obterAuth();
    if (!auth) {
      setErro('Login indisponível neste ambiente.');
      return;
    }
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (!code.includes('popup-closed') && !code.includes('cancelled-popup')) setErro('Não deu para entrar com o Google. Tente de novo.');
    }
  }, []);

  const sair = useCallback(async () => {
    const auth = await obterAuth();
    if (!auth) return;
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
  }, []);

  const valor = useMemo(() => ({ usuario, pronto, disponivel, entrar, entrarAnonimo, sair, token, erro }), [usuario, pronto, disponivel, entrar, entrarAnonimo, sair, token, erro]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
