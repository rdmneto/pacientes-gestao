# OftalmoCare — Sistema de Gestão de Pacientes Cirúrgicos Oftalmológicos

## Visão Geral

Sistema SaaS Multi-tenant para acompanhamento e controle de pacientes cirúrgicos oftalmológicos. Desenvolvido para clínicas e consultórios com foco em Catarata, Cirurgia Refrativa e Retina/Vítreo.

---

## Estrutura do Projeto

```
Gestão pacientes/
├── firebase/                    # Configurações do Firebase
│   ├── firestore.rules          # Regras de segurança Firestore
│   ├── storage.rules            # Regras do Firebase Storage
│   └── firestore.indexes.json   # Índices compostos
│
├── src/
│   ├── db/
│   │   ├── db.schema.js         # ✅ Schema, enums, funções clínicas
│   │   └── db.schema.test.js    # ✅ Testes unitários
│   │
│   ├── auth/                    # [Etapa 2] Autenticação e Multi-tenancy
│   ├── api/                     # [Etapa 3] Backend e rotas CRUD
│   ├── pages/                   # [Etapas 4-5] Telas do frontend
│   └── components/              # [Etapas 4-5] Componentes reutilizáveis
│
├── database/
│   └── schema.md                # Documentação do banco de dados
│
└── README.md                    # Este arquivo
```

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | HTML5 + CSS3 (Vanilla) + JavaScript ES Modules |
| **Banco de Dados** | Firebase Firestore (NoSQL) |
| **Autenticação** | Firebase Authentication |
| **Storage** | Firebase Storage |
| **Gráficos (BI)** | Chart.js |
| **WhatsApp** | Meta Cloud API (WhatsApp Business) |
| **Hospedagem** | Hostinger (Static) + Firebase Hosting |

---

## Etapas de Implementação

| # | Etapa | Status |
|---|-------|--------|
| 1 | **Modelagem do Banco de Dados (DB Schema)** | ✅ Concluída |
| 2 | Setup de Autenticação e Multi-tenancy | 🔄 Próxima |
| 3 | Backend & Lógica de Negócio (API) | ⏳ Pendente |
| 4 | Frontend - Prontuário e Lógica Condicional | ⏳ Pendente |
| 5 | Frontend - Agenda e Dashboard | ⏳ Pendente |
| 6 | Integração Meta API (WhatsApp) | ⏳ Pendente |

---

## Configuração Inicial

### Pré-requisitos
- Conta no [Firebase Console](https://console.firebase.google.com)
- Node.js 18+
- Conta na Hostinger

### Setup do Firebase
1. Criar novo projeto no Firebase Console
2. Ativar **Authentication** (Email/Password)
3. Ativar **Firestore Database** (modo produção)
4. Ativar **Storage**
5. Copiar as credenciais do projeto para `src/config/firebase.config.js`
6. Fazer deploy das regras:
   ```bash
   firebase deploy --only firestore:rules,storage,firestore:indexes
   ```

---

## Módulos do Sistema

### 1. Cadastro de Pacientes
- Dados pessoais + CPF (com validação)
- Dados clínicos e patologia principal
- Upload de anexos (OCT, Topografia, Pentacam, etc.)

### 2. Prontuário Cirúrgico
- **Catarata:** Dados da LIO, técnica, microscopia especular
- **Refrativa:** Tipo de erro refrativo, programação cirúrgica, paquimetria
- **Retina/Vítreo:** Buraco Macular, MER, DR, Injeções Intravítreas

### 3. Agenda Cirúrgica
- Calendário interativo
- Agendamento de cirurgias, laser e injeções

### 4. Dashboard de BI
- Gráficos de AV pré/pós-op (LogMAR)
- Taxas de sucesso por patologia
- Volume de procedimentos por período

### 5. Comunicação WhatsApp
- Templates de orientações pré/pós-operatórias
- Disparo automático ou manual

---

## Funções Clínicas Implementadas

### Conversão Snellen → LogMAR
```js
snellenToLogMAR('20/200') // → 1.0
snellenToLogMAR('20/20')  // → 0.0
snellenToLogMAR('CD')     // → 2.7 (Conta Dedos)
```

### Equivalente Esférico
```js
calcSphericalEquivalent(-2.00, -1.00) // → -2.50
calcSphericalEquivalent(+1.00, -2.00) // → 0.00
```

---

## Multi-tenancy

Cada médico/clínica é um **tenant** isolado. O campo `tenantId` (igual ao UID do médico-proprietário) é a chave de isolamento em **todas** as coleções.

As regras do Firestore garantem que:
- Médicos só veem seus próprios pacientes
- Novos usuários entram com status `pending` e precisam de aprovação do Super Admin
- O Super Admin tem visibilidade total do sistema
