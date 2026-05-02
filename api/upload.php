<?php
/**
 * OftalmoCare — File Upload API (Hostinger)
 * Endpoint para upload, listagem e exclusão de anexos médicos.
 * 
 * Deploy: Coloque este arquivo em /api/upload.php na sua hospedagem Hostinger.
 * Os arquivos ficam salvos em /uploads/ (fora do public_html, idealmente).
 */

// ── CORS ────────────────────────────────────────────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Tenant-ID, X-Auth-Token');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── CONFIG ──────────────────────────────────────────────────────
// Diretório onde os arquivos serão armazenados.
// IMPORTANTE: Crie esta pasta no gerenciador de arquivos da Hostinger.
// Idealmente fora de public_html para segurança, mas dentro funciona também.
define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('MAX_FILE_SIZE', 50 * 1024 * 1024); // 50MB

// Tipos de arquivo permitidos
$ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
    'application/pdf',
];

// Token simples de segurança (configure no .env ou altere aqui)
// Este token deve ser o mesmo configurado no front-end.
define('API_SECRET', 'CHANGE_THIS_TO_A_SECURE_RANDOM_STRING');

// ── SEGURANÇA ───────────────────────────────────────────────────
function validateRequest() {
    $token = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
    if ($token !== API_SECRET) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Token inválido.']);
        exit;
    }

    $tenantId = $_SERVER['HTTP_X_TENANT_ID'] ?? '';
    if (empty($tenantId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Tenant ID ausente.']);
        exit;
    }
    return $tenantId;
}

// ── UPLOAD (POST) ───────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $tenantId = validateRequest();

    if (!isset($_FILES['file'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Nenhum arquivo enviado.']);
        exit;
    }

    $file = $_FILES['file'];

    // Validar erros de upload
    if ($file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Erro no upload: código ' . $file['error']]);
        exit;
    }

    // Validar tamanho
    if ($file['size'] > MAX_FILE_SIZE) {
        http_response_code(413);
        echo json_encode(['success' => false, 'error' => 'Arquivo excede o limite de 50MB.']);
        exit;
    }

    // Validar tipo MIME
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    global $ALLOWED_TYPES;
    if (!in_array($mimeType, $ALLOWED_TYPES)) {
        http_response_code(415);
        echo json_encode(['success' => false, 'error' => 'Tipo de arquivo não permitido: ' . $mimeType]);
        exit;
    }

    // Criar diretório do tenant (isolamento de dados)
    $tenantDir = UPLOAD_DIR . $tenantId . '/';
    if (!is_dir($tenantDir)) {
        mkdir($tenantDir, 0755, true);
    }

    // Gerar nome único para evitar colisões
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $safeName = bin2hex(random_bytes(16)) . '.' . strtolower($ext);
    $destPath = $tenantDir . $safeName;

    // Mover arquivo
    if (move_uploaded_file($file['tmp_name'], $destPath)) {
        // Montar URL pública
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'];
        $baseUrl = $protocol . '://' . $host;
        $fileUrl = $baseUrl . '/uploads/' . $tenantId . '/' . $safeName;

        echo json_encode([
            'success' => true,
            'url' => $fileUrl,
            'fileName' => $file['name'],
            'storedName' => $safeName,
            'fileSize' => $file['size'],
            'fileType' => $mimeType,
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Falha ao salvar arquivo no servidor.']);
    }
    exit;
}

// ── DELETE ───────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $tenantId = validateRequest();

    // Receber nome do arquivo via query string: ?file=abc123.pdf
    $storedName = $_GET['file'] ?? '';
    if (empty($storedName)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Nome do arquivo não informado.']);
        exit;
    }

    // Segurança: impedir path traversal
    $storedName = basename($storedName);
    $filePath = UPLOAD_DIR . $tenantId . '/' . $storedName;

    if (file_exists($filePath)) {
        unlink($filePath);
        echo json_encode(['success' => true]);
    } else {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Arquivo não encontrado.']);
    }
    exit;
}

// ── Método não suportado ────────────────────────────────────────
http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método não suportado.']);
