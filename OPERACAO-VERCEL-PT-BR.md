# Operação da implantação Vercel (pt-BR)

## Voz

`GOOGLE_API_KEY`, `GOOGLE_MODELS` e `DEFAULT_MODEL` configuram o provedor de texto. Eles não habilitam síntese de voz. Para áudio gerado no servidor, configure um provedor TTS à parte; por exemplo, OpenAI usa `TTS_OPENAI` para habilitar o provedor e `TTS_OPENAI_API_KEY` para sua credencial (e aceita `TTS_OPENAI_MODELS`/`TTS_OPENAI_BASE_URL` quando necessários). Veja a lista completa no `.env.example` e a seção de provedores de áudio nas Configurações. Nunca coloque chaves no repositório.

Sem provedor pago, selecione **Browser Native (Web Speech API)** em Configurações → Áudio/TTS e ative a narração. Essa alternativa usa as vozes instaladas no dispositivo, sem chave e sem salvar arquivos de áudio. A disponibilidade de uma voz em português do Brasil (`pt-BR`) varia por sistema operacional e navegador. Em navegadores móveis, a reprodução precisa começar a partir de um toque do usuário; toque em Reproduzir para iniciar ou retomar.

## Tempo de criação

Os logs do navegador mostram `Outline generation finished` e, por cena, as durações de conteúdo, ações e narração. Ao terminar, `Course scene generation finished` informa o tempo total e os acumulados de cada etapa. Compare esses campos em uma aula de teste para identificar a etapa dominante; conteúdo pode ocorrer em paralelo, então seus tempos acumulados podem superar o tempo total.

As etapas simples podem usar um modelo Gemini mais leve já cadastrado em `GOOGLE_MODELS`: em **Configurações → Modelos → Rotas por etapa**, escolha esse modelo para `scene-outlines-stream`, `scene-content` e `scene-actions`, mantendo o modelo atual como fallback para as demais tarefas. Alternativamente, configure `MODEL_ROUTES` no ambiente da Vercel, seguindo o formato documentado em `.env.example`. Se as cotas da API permitirem, `PARALLEL_SCENE_CONCURRENCY=2` habilita duas gerações de conteúdo simultâneas; conteúdo de cenas é independente, enquanto ações e falas permanecem ordenadas. A configuração padrão continua serial para reduzir erros de limite de taxa.

A criação comum agora começa com aproximadamente 8–10 cenas para uma aula de 8–10 minutos; pedidos explícitos e modos de prática profissional mantêm suas necessidades próprias. Geração de imagens já vem desligada (`imageGenerationEnabled: false`); mantenha-a assim para reduzir chamadas e custo, e habilite-a apenas se precisar de ilustrações.

`vercel.json` declara limite de até 300 segundos para funções de API, sujeito ao limite do plano Vercel. A geração da aula usa requisições por etapa/cena e streaming do esboço; não aumente a duração global sem verificar o plano. Em Preview, observe os tempos por etapa e os logs de função, e confira que uma aula longa não depende de uma única execução que exceda o teto da plataforma.

## Conferência do Preview

1. Abra o Preview do PR em uma janela de 380 px (ou em um aparelho real): confira página inicial, Configurações, geração de aula e sala de aula; não deve haver rolagem horizontal. Em iOS, confira a área segura ao redor do notch e se tocar num campo não amplia a página.
2. Em Configurações → TTS, escolha Browser Native, use **Testar voz** e selecione uma voz `pt-BR` se o dispositivo oferecer uma. Na sala, toque em Reproduzir; confirme que fala após o toque. Para TTS de servidor, confira no log de inicialização a contagem de provedores sem copiar credenciais para logs ou tickets.
3. Gere uma aula curta sem imagens e compare as durações de outline, conteúdo, ações e TTS nos logs. Se a cota de Gemini suportar, aplique rotas para um modelo leve e `PARALLEL_SCENE_CONCURRENCY=2` somente no Preview, e compare novamente. Confirme que ilustrações não são solicitadas sem ativar o controle de imagens.

