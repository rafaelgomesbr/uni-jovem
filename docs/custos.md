# Custos e serviços externos

> **Aviso:** preços e limites consultados em **14/11/2026**, em **dólar americano (US$)**, nas fontes listadas no fim. Mudam sem aviso e precisam ser reconfirmados na ativação de cada serviço. Os valores abaixo são **estimativas, não garantia** de custo.

Teto de gasto recorrente: **R$ 0** (D4 em [`DECISOES.md`](DECISOES.md)). Qualquer serviço pago vira pedido de autorização em [`PENDENCIAS-HUMANAS.md`](PENDENCIAS-HUMANAS.md) antes de ser ativado.

Estado em 15/11/2026, todos no plano gratuito (gasto recorrente R$ 0): **Expo EAS** (projeto `uni-jovem`; as builds iOS do mês acabaram e voltam em 01/12/2026, por isso o iOS é compilado no Mac; 1 build Android de produção usado), **Firebase/FCM** (projeto `uni-jovem`, D21) e **APNs** (chave da conta Apple já paga, D22). Resend, R2, Turnstile real, Sentry e Google Maps seguem **não ativados**.

## Serviços

| Serviço                                     | Uso                              | Limite gratuito                                                                     | Pago (referência)                                                            |
| ------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Mac mini + Docker + Cloudflare Tunnel e DNS | Hospedagem, banco, arquivos, TLS | Já existente; Tunnel e DNS gratuitos                                                | Energia e internet já pagas                                                  |
| Resend                                      | E-mail transacional              | 3.000 por mês, **100 por dia**, 1 domínio                                           | Pro: US$ 20 por mês (50 mil e-mails)                                         |
| Expo EAS                                    | Builds e envio às lojas          | 15 builds iOS + 15 Android por mês (fila lenta; build cancelado após 45 min)        | Starter: US$ 19 por mês                                                      |
| FCM e APNs                                  | Push                             | Gratuitos                                                                           | (não se aplica)                                                              |
| Google Maps SDK (Android e iOS nativos)     | Mapa no app                      | Carregamento nativo sem map ID: US$ 0, ilimitado                                    | A API JavaScript na web cobra por carga; a web usa só o link "abrir no mapa" |
| Apple Maps (iOS)                            | Mapa no iOS                      | Gratuito                                                                            | (não se aplica)                                                              |
| Cloudflare R2                               | Cópia externa dos backups        | 10 GB-mês + operações                                                               | US$ 0,015 por GB-mês                                                         |
| Cloudflare Turnstile                        | Antispam nas páginas públicas    | Gratuito                                                                            | (não se aplica)                                                              |
| Sentry (opcional)                           | Erros                            | 5 mil erros por mês, 1 usuário                                                      | Team: US$ 26 por mês                                                         |
| Monitor externo de disponibilidade          | Alerta se o Mac cair             | Plano gratuito (ex.: UptimeRobot). **Preço não consultado ainda; confirmar na F6.** | (não consultado)                                                             |
| Apple Developer e Google Play               | Lojas                            | Contas já existentes                                                                | Apple: US$ 99 por ano, já pago pelo dono                                     |

**Fontes conflitantes sobre o EAS gratuito:** as fontes mais recentes citam 15 builds iOS + 15 Android por mês; a página oficial ainda citava 30 em 14/11/2026. Reconfirmar em [expo.dev/pricing](https://expo.dev/pricing) antes da F19.

## Cenários

| Cenário                   | Premissas                                                                                                                                                            | Custo recorrente estimado                                                                                                                                                                                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Uma comunidade pequena | ~60 contas, 40 ativas por semana, 8 eventos por mês, 150 inscrições públicas por mês, menos de 1 GB de arquivos, ~2 mil pushes por mês, menos de 300 e-mails por mês | **US$ 0** (cabe no D4)                                                                                                                                                                                                                                                                               |
| 2. Várias comunidades     | 10 comunidades, ~600 contas, 300 ativas, 80 eventos por mês, 1.500 inscrições por mês, ~10 GB, ~20 mil pushes                                                        | De US$ 0 a cerca de US$ 20 por mês. O gargalo provável é o teto de **100 e-mails por dia** do Resend em picos de convite. Mitigação: e-mail só para o essencial, push para o resto. Qualquer gasto exige autorização antes.                                                                          |
| 3. Cadastro público       | 5 a 20 mil contas                                                                                                                                                    | O Mac doméstico deixa de ser adequado (disponibilidade). Itens: servidor e Postgres gerenciados (**não cotados**; cotar quando o cenário se aproximar), Resend Pro ou Scale de US$ 20 a 90, EAS Starter US$ 19, Sentry Team US$ 26. Ordem de grandeza: mais de US$ 65 por mês **mais** a hospedagem. |

## Riscos de custo

- Estouro do teto de e-mail do Resend (100 por dia).
- Builds do EAS acima da cota. Reserva: build iOS local no Mac.
- Mapa na web, se um dia o link "abrir no mapa" for trocado por mapa interativo.
- Crescimento dos arquivos (anexos de eventos) e dos backups no R2.

## Alertas

Contadores de e-mail e push no painel do Criador, com aviso ao atingir **80% da cota** (requisito CUS-02 em [`rastreabilidade.md`](rastreabilidade.md)). Planejado para as F6 e F14; não existe ainda.

## Fontes

Consultadas em 14/11/2026.

- [Resend pricing (CostBench, Activepieces, Toolradar)](https://www.activepieces.com/blog/resend-pricing-2026-free-tier-plans-and-limits)
- [Expo pricing](https://expo.dev/pricing)
- [Expo plans](https://docs.expo.dev/billing/plans.md)
- [Toolradar Expo](https://toolradar.com/tools/expo/pricing)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing)
- [Google Maps SDK Android billing](https://developers.google.com/maps/documentation/android-sdk/usage-and-billing)
- [Sentry pricing](https://sentry.io/pricing/)
- [Bíblia Livre: licença (eBible)](https://ebible.org/porbr2018/copyright.htm) (licença do versículo diário, D2; sem custo)
