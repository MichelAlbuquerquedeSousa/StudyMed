# Publicar e instalar o StudyMed (PWA)

Para instalar no iPhone e no tablet, o app precisa estar publicado num endereço **HTTPS**.
O caminho gratuito recomendado é a **Vercel** (plano Hobby, para uso pessoal).

## 1. Publicar na Vercel (uma vez, ~5 minutos)

1. Acesse <https://vercel.com/signup> e entre com a sua conta do **GitHub**.
2. Clique em **Add New… → Project** e importe o repositório **StudyMed**
   (se ele não aparecer, autorize o acesso da Vercel a esse repositório).
3. A Vercel detecta Next.js automaticamente. Antes de publicar, abra
   **Environment Variables** e cadastre as duas variáveis (os mesmos valores do seu `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Clique em **Deploy**. Ao final, você recebe um endereço como `https://studymed-xxxx.vercel.app`.
   (Em **Settings → Domains** dá para trocar por um nome mais fácil, ex.: `studymed-seunome.vercel.app`.)

A partir daí, **cada envio para a branch `main` publica uma nova versão automaticamente**.
O app instalado mostra o aviso "Nova versão do StudyMed disponível → Atualizar".

## 2. Avisar o Supabase sobre o novo endereço

No Supabase: **Authentication → URL Configuration**

- **Site URL**: troque para o endereço da Vercel (ex.: `https://studymed-seunome.vercel.app`).
- **Redirect URLs**: adicione `https://studymed-seunome.vercel.app/**`
  (mantenha `http://localhost:3000/**` para continuar testando no computador).

Sem isso, o link de "Esqueci minha senha" não volta para o app publicado.

## 3. Instalar

### iPhone (Safari)
1. Abra o endereço no **Safari** (no iPhone, só o Safari instala apps da web).
2. Toque em **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início** → **Adicionar**.
3. Abra o StudyMed pelo ícone e **faça login lá dentro** — o app instalado no iPhone
   tem armazenamento separado do Safari, então pede login uma vez.

### Tablet Samsung (Chrome ou Samsung Internet)
1. Abra o endereço.
2. Chrome: menu **⋮ → Instalar app**. Samsung Internet: menu **≡ → Adicionar página a → Tela inicial**.
   (Em Ajustes, dentro do app, também aparece o botão **Instalar o StudyMed** quando disponível.)

### Computador (Chrome ou Edge)
Ícone de instalação na barra de endereço, ou menu **⋮ → Instalar StudyMed**.

## Como funciona sem internet

- As telas principais e os seus dados ficam guardados no aparelho depois do primeiro acesso logado.
- Sem conexão, o app abre normalmente e mostra um aviso no topo. Dá para **consultar** tudo;
  **alterações não são salvas** enquanto estiver offline — o app avisa e desfaz a mudança na tela.
- Ao sair da conta, as páginas guardadas e o cache de dados do aparelho são apagados.
- Uma prova que nunca foi aberta naquele aparelho mostra uma página "Você está sem internet".
