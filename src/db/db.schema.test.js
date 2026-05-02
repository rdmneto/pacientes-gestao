/**
 * ═══════════════════════════════════════════════════════════════════
 * OftalmoCare — db.schema.test.js
 * Testes unitários das funções utilitárias de cálculo clínico
 * Executar com: node db.schema.test.js
 * ═══════════════════════════════════════════════════════════════════
 */

import {
  snellenToLogMAR,
  logmarToSnellenApprox,
  calcSphericalEquivalent,
  calcVisualAcuityOutcome,
  validateCPF,
  formatCPF,
  calcAge,
} from './db.schema.js';

// ─────────────────────────────────────────────────────────────────
// Mini test runner
// ─────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}`);
    console.log(`     → ${e.message}`);
    failed++;
  }
}

function expect(received) {
  return {
    toBe(expected) {
      if (received !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(received)}`);
      }
    },
    toBeNull() {
      if (received !== null) {
        throw new Error(`Expected null, got ${JSON.stringify(received)}`);
      }
    },
    toBeCloseTo(expected, decimals = 2) {
      const factor = Math.pow(10, decimals);
      if (Math.round(received * factor) !== Math.round(expected * factor)) {
        throw new Error(`Expected ~${expected}, got ${received}`);
      }
    },
    toBeTrue() {
      if (received !== true) throw new Error(`Expected true, got ${received}`);
    },
    toBeFalse() {
      if (received !== false) throw new Error(`Expected false, got ${received}`);
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// TESTES: snellenToLogMAR
// ─────────────────────────────────────────────────────────────────
console.log('\n📊 snellenToLogMAR()');

test('20/20 deve retornar 0.0 (visão normal)', () => {
  expect(snellenToLogMAR('20/20')).toBe(0.0);
});

test('20/200 deve retornar 1.0 (baixa visão grave)', () => {
  expect(snellenToLogMAR('20/200')).toBe(1.0);
});

test('20/40 deve retornar 0.3', () => {
  expect(snellenToLogMAR('20/40')).toBeCloseTo(0.3);
});

test('20/100 deve retornar 0.7', () => {
  expect(snellenToLogMAR('20/100')).toBeCloseTo(0.7);
});

test('20/400 deve retornar 1.3', () => {
  expect(snellenToLogMAR('20/400')).toBeCloseTo(1.3);
});

test('20/25 deve retornar 0.1', () => {
  expect(snellenToLogMAR('20/25')).toBeCloseTo(0.1);
});

test('"CD" deve retornar 2.7', () => {
  expect(snellenToLogMAR('CD')).toBe(2.7);
});

test('"MM" deve retornar 2.8', () => {
  expect(snellenToLogMAR('MM')).toBe(2.8);
});

test('"PL" deve retornar 2.9', () => {
  expect(snellenToLogMAR('PL')).toBe(2.9);
});

test('"SPL" deve retornar 3.0', () => {
  expect(snellenToLogMAR('SPL')).toBe(3.0);
});

test('null deve retornar null', () => {
  expect(snellenToLogMAR(null)).toBeNull();
});

test('string inválida deve retornar null', () => {
  expect(snellenToLogMAR('invalido')).toBeNull();
});

test('string vazia deve retornar null', () => {
  expect(snellenToLogMAR('')).toBeNull();
});

// ─────────────────────────────────────────────────────────────────
// TESTES: logmarToSnellenApprox
// ─────────────────────────────────────────────────────────────────
console.log('\n🔄 logmarToSnellenApprox()');

test('0.0 deve retornar "20/20"', () => {
  expect(logmarToSnellenApprox(0.0)).toBe('20/20');
});

test('1.0 deve retornar "20/200"', () => {
  expect(logmarToSnellenApprox(1.0)).toBe('20/200');
});

test('3.0 deve retornar "SPL"', () => {
  expect(logmarToSnellenApprox(3.0)).toBe('SPL');
});

test('2.9 deve retornar "PL"', () => {
  expect(logmarToSnellenApprox(2.9)).toBe('PL');
});

test('null deve retornar "—"', () => {
  expect(logmarToSnellenApprox(null)).toBe('—');
});

// ─────────────────────────────────────────────────────────────────
// TESTES: calcSphericalEquivalent
// ─────────────────────────────────────────────────────────────────
console.log('\n🔢 calcSphericalEquivalent()');

test('-2.00 esférico, -1.00 cilindro → SE = -2.50', () => {
  expect(calcSphericalEquivalent(-2.00, -1.00)).toBe(-2.5);
});

test('+1.00 esférico, -2.00 cilindro → SE = 0.00', () => {
  expect(calcSphericalEquivalent(1.00, -2.00)).toBe(0.00);
});

test('-5.00 esférico, 0 cilindro → SE = -5.00 (sem astigmatismo)', () => {
  expect(calcSphericalEquivalent(-5.00, 0)).toBe(-5.00);
});

test('+3.50 esférico, -0.75 cilindro → SE = +3.125 ≈ 3.13', () => {
  expect(calcSphericalEquivalent(3.50, -0.75)).toBe(3.13);
});

test('null esférico → null', () => {
  expect(calcSphericalEquivalent(null, -1.00)).toBeNull();
});

test('esférico sem cilindro → retorna esférico', () => {
  expect(calcSphericalEquivalent(-3.00, null)).toBe(-3.00);
});

// ─────────────────────────────────────────────────────────────────
// TESTES: calcVisualAcuityOutcome
// ─────────────────────────────────────────────────────────────────
console.log('\n📈 calcVisualAcuityOutcome()');

test('Melhora: pré 1.0, pós 0.0 → delta positivo', () => {
  const result = calcVisualAcuityOutcome(1.0, 0.0);
  expect(result.delta).toBe(1.0);
  expect(result.improved).toBeTrue();
});

test('Piora: pré 0.0, pós 0.3 → delta negativo', () => {
  const result = calcVisualAcuityOutcome(0.0, 0.3);
  expect(result.delta).toBe(-0.3);
  expect(result.improved).toBeFalse();
});

test('null retorna null', () => {
  const result = calcVisualAcuityOutcome(null, 0.0);
  expect(result).toBeNull();
});

// ─────────────────────────────────────────────────────────────────
// TESTES: validateCPF
// ─────────────────────────────────────────────────────────────────
console.log('\n🪪 validateCPF()');

test('CPF válido com formatação', () => {
  expect(validateCPF('529.982.247-25')).toBeTrue();
});

test('CPF válido sem formatação', () => {
  expect(validateCPF('52998224725')).toBeTrue();
});

test('CPF com todos dígitos iguais deve ser inválido', () => {
  expect(validateCPF('111.111.111-11')).toBeFalse();
});

test('CPF com dígito verificador errado deve ser inválido', () => {
  expect(validateCPF('123.456.789-00')).toBeFalse();
});

test('CPF muito curto deve ser inválido', () => {
  expect(validateCPF('12345')).toBeFalse();
});

// ─────────────────────────────────────────────────────────────────
// TESTES: formatCPF
// ─────────────────────────────────────────────────────────────────
console.log('\n🖊️ formatCPF()');

test('Formata CPF numérico', () => {
  expect(formatCPF('52998224725')).toBe('529.982.247-25');
});

test('CPF já formatado não quebra', () => {
  expect(formatCPF('529.982.247-25')).toBe('529.982.247-25');
});

// ─────────────────────────────────────────────────────────────────
// RESULTADO FINAL
// ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`📋 Resultado: ${passed} passaram | ${failed} falharam`);
if (failed === 0) {
  console.log('🎉 Todos os testes passaram!\n');
} else {
  console.log(`⚠️  ${failed} teste(s) com falha.\n`);
  process.exit(1);
}
