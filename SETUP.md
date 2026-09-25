# Estudar PWA — Setup Completo

## 1. Deploy com GitHub + Cloudflare Pages (gratuito)

### Passo 1: Criar repositório no GitHub
1. Vai a https://github.com/new
2. Nome: `estudar` (ou o que preferires)
3. Cria o repo e faz push:

```bash
cd C:\Users\RyanS\Documents\estudar
git init
git add .
git commit -m "feat: PWA de estudo focado"
git remote add origin https://github.com/TEU_USER/estudar.git
git push -u origin main
```

### Passo 2: Deploy no Cloudflare Pages
1. Vai a https://dash.cloudflare.com → Pages → Create a project
2. Clica "Connect to Git" e seleciona o repo `estudar`
3. Framework preset: `None`
4. Build command: (deixa vazio)
5. Build output directory: `/`
6. Clica "Save and Deploy"
7. O teu site fica em `estudar.pages.dev`

---

## 2. Sincronização entre dispositivos (Firebase — gratuito)

### Passo 1: Criar projeto Firebase
1. Vai a https://console.firebase.google.com
2. Clica "Add project" → nome: `estudar` → continua
3. Desativa Google Analytics (não precisas) → Create project

### Passo 2: Ativar autenticação Google
1. No painel do Firebase → Authentication → Get started
2. Sign-in method → Google → Enable
3. Adiciona o teu email como suporte → Save

### Passo 3: Criar base de dados Firestore
1. Firestore Database → Create database
2. Start in **test mode** (vamos configurar regras depois)
3. Escolhe a localização mais perto (europe-west1 ou eur3)

### Passo 4: Adicionar domínio autorizado
1. Authentication → Settings → Authorized domains
2. Adiciona `estudar.pages.dev` (o teu domínio do Cloudflare)

### Passo 5: Obter config do Firebase
1. Project settings (ícone de engrenagem) → General
2. Em "Your apps" → clica no ícone `</>`  (Web)
3. Nome: `Estudar` → Register app
4. Copia o objeto `firebaseConfig`:

```json
{
  "apiKey": "AIza...",
  "authDomain": "estudar-xxxxx.firebaseapp.com",
  "projectId": "estudar-xxxxx",
  "storageBucket": "estudar-xxxxx.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abcdef"
}
```

### Passo 6: Configurar no app
1. Abre a app no browser/telemóvel
2. Clica no ícone ⚙ (definições)
3. Cola o JSON do Firebase no campo de texto
4. Clica "Conectar Firebase"
5. Faz login com a tua conta Google
6. Pronto! Os dados sincronizam automaticamente entre todos os dispositivos

### Passo 7: Regras de segurança do Firestore
No Firestore → Rules, substitui por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 3. Instalar como app (PWA)

### No telemóvel (Android/Chrome):
1. Abre `estudar.pages.dev` no Chrome
2. Aparece banner "Adicionar ao ecrã inicial" → aceita
3. Ou: menu (⋮) → "Instalar app"

### No iPhone (Safari):
1. Abre `estudar.pages.dev` no Safari
2. Toca no ícone de partilha (⬆)
3. "Adicionar ao ecrã inicial"

### No computador (Chrome/Edge):
1. Abre `estudar.pages.dev`
2. Clica no ícone de instalação na barra de endereço (⊕)
3. Ou: menu → "Instalar Estudar"

---

## Funcionalidades

- **Modo Foco**: Ecrã inteiro, sem distrações, ecrã sempre ligado
- **Timer Pomodoro**: 25min estudo / 5min pausa, configurável
- **Plano semanal**: Todas as sessões do plano, com tracking
- **Gantt do semestre**: Roadmap visual de Sep 2026 a Jan 2027
- **Fases automáticas**: 60/40 → 40/60 → 20/80 → SIM
- **Checklist semanal**: As 5 perguntas de auto-avaliação
- **Sincronização**: Firebase Auth + Firestore em tempo real
- **PWA**: Funciona offline, instalável no telemóvel e computador
