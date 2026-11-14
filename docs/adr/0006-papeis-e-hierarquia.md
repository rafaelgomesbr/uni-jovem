# ADR 0006: Papéis por comunidade com hierarquia numérica, e Criador como atributo global

- **Estado:** aceita
- **Data:** 14/11/2026
- **Decisões relacionadas:** D6 em [`../DECISOES.md`](../DECISOES.md)

## Contexto

Cada comunidade tem sua liderança, e a mesma pessoa pode ser admin numa comunidade e membro em outra (D6). O dono do produto (o Criador) precisa criar comunidades e socorrer uma comunidade que ficou sem admin, mas não deve, só por ser o dono, ler pedidos de oração nem notas privadas. Regras de permissão espalhadas pelo código divergem com o tempo.

## Decisão

- **Papel vive no vínculo** (conta × comunidade), nunca na conta. Papéis: `admin` (30), `organizador` (20), `membro` (10). "Membro" substitui o antigo "Leitor".
- **Hierarquia numérica:** ninguém concede, altera ou remove papel acima do próprio nível; ninguém altera o próprio papel. Na v1, só admin concede papéis.
- **Designações** (como `equipe_oracao`) são atributos do vínculo, não papéis.
- **Último admin protegido:** a comunidade não pode ficar sem admin ativo; o bloqueio está na API **e** num trigger do banco. A exceção é a intervenção do Criador, que pode nomear um novo admin.
- **Criador** não é papel de comunidade: é atributo global único (`plataforma_proprietario`), nunca concedido por convite. Admin, organizador e membro **nunca** bloqueiam, rebaixam ou removem a conta do Criador. Transferência só por fluxo próprio: senha e TOTP do atual, aceite com 2FA do destinatário, espera de 72 h cancelável, auditoria e e-mail aos dois.
- **Criador dentro de uma comunidade** só age quando tem vínculo nela ou em **modo de intervenção explícita**: auditado, com motivo obrigatório e sem acesso a pedidos de oração e notas privadas.
- **Uma única fonte:** a matriz papel × recurso × ação vive em código em `packages/dominio`; `docs/matriz-permissoes.md` é gerado dela; o teste percorre **todas** as células. Negar por padrão.
- **Encerramentos distintos:** excluir conta global, sair de comunidade, admin remove vínculo, desativar vínculo (reversível), revogar sessão ou aparelho, anonimizar histórico (autoria vira "Pessoa removida", contagens ficam).

## Consequências

- Mudar uma permissão é mudar uma linha da matriz e ver os testes apontarem o efeito.
- O Criador tem poder de plataforma, mas o produto não lhe dá leitura de conteúdo privado. **Limite honesto:** como operador do servidor, ele tem capacidade técnica de decifrar o que a aplicação cifra (limite L02); a garantia vale para o produto e a interface, não contra quem opera a infraestrutura.
- A regra do último admin em duas camadas evita comunidade órfã mesmo com erro na API.
- Estado em 14/11/2026: `packages/dominio/src/papeis.ts` tem os papéis, os níveis e `podeConcederPapel`, com 3 testes; a matriz completa é da F2.

## Alternativas rejeitadas

- **Papel global por conta:** impede a mesma pessoa de ter papéis diferentes em comunidades diferentes.
- **Criador como "superadmin" de todas as comunidades:** daria acesso automático a conteúdo privado.
- **Permissões espalhadas nas rotas:** divergem e não dá para testar todas as combinações.
- **Lista de papéis sem ordem:** obriga a escrever cada par "quem pode mexer em quem" à mão.

## Inspiração

- `C:\Projetos\city-hall\docs\adr\0006-administrador-e-o-teto-do-municipio.md` (ADR 0006 do dc360: papéis com hierarquia numérica).
