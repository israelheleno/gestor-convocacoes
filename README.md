# Gestor de Convocações — Câmara Municipal

PWA para organização automática de agendas de convocações.

## Estrutura do Projeto

```
gestor-convocacoes/
├── index.html          ← Dashboard principal
├── login.html          ← Tela de login/cadastro
├── manifest.json       ← Configuração PWA
├── service-worker.js   ← Cache offline
└── js/
    ├── firebase-config.js  ← Conexão Firebase
    ├── ocr-engine.js       ← Leitura de imagens (Tesseract)
    └── matcher.js          ← Cruzamento de nomes
```

## Deploy no GitHub Pages

### 1. Criar repositório
1. Acesse github.com e crie um repositório novo (ex: `gestor-convocacoes`)
2. Deixe como **público** (necessário para o Pages gratuito)

### 2. Enviar arquivos
```bash
git init
git add .
git commit -m "Primeiro commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/gestor-convocacoes.git
git push -u origin main
```

### 3. Ativar GitHub Pages
1. No repositório, vá em **Settings → Pages**
2. Em "Source", selecione **Deploy from a branch**
3. Escolha branch `main` e pasta `/` (root)
4. Clique em **Save**
5. Aguarde ~2 minutos. Seu app estará em:
   `https://SEU_USUARIO.github.io/gestor-convocacoes`

### 4. Configurar domínio autorizado no Firebase
1. Firebase Console → Authentication → Settings → Authorized domains
2. Adicione: `SEU_USUARIO.github.io`

### 5. Configurar regras do Firestore
No Firebase Console → Firestore → Rules, cole:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuários: cada um lê/edita o próprio perfil
    match /usuarios/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }
    // Grupos: qualquer autenticado lê, membros editam
    match /grupos/{grupoId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    // Eventos: qualquer membro autenticado
    match /eventos/{eventoId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Como usar

1. **Cadastro**: Acesse o link, crie conta com e-mail/senha ou Google
2. **Grupo**: Crie ou solicite entrada em um grupo (qualquer membro aprova)
3. **Escanear**: Clique no botão azul (câmera) no canto inferior direito
4. **Tirar foto** da convocação impressa ou escolher da galeria
5. **Conferir dados**: Revise os dados lidos automaticamente
6. **Confirmar**: Salva e notifica os membros identificados
7. **Agenda**: Cada usuário clica em "Adicionar à Agenda" para salvar no celular

## Instalar no celular (Android)
- Abra o link no Chrome → Menu (⋮) → "Adicionar à tela inicial"

## Instalar no celular (iPhone)
- Abra o link no Safari → Compartilhar → "Adicionar à Tela de Início"
