# 📋 Audit Công Việc – quocdat2601 (AI Study Hub)

> Tài liệu này mô tả toàn bộ những gì **quocdat2601** đã xây dựng, viết và đóng góp trong repository AI-Study-Hub.
> Các hàm/module được sắp xếp theo thứ tự phụ thuộc: hàm nền tảng → hàm trung gian → hàm cấp cao nhất.

---

## 📌 Tổng Quan Commit History

| Commit | Nội dung |
|--------|----------|
| `9b1c7d1` | fix: caret position, UI/UX admin, document api |
| `5dc233b` | feat: add verify chatbot answer step |
| `ece863c` | fix: admin auth and egress audit |
| `fdb8514` | fix: chatbot with public doc and some UI update |
| `6184c5b` | fix: chatbot behaviour and UI update |
| `b8c90c7` | feat: update UI |
| `7bb2782` | fix: update chatbot behaviour |
| `43a32ab` | feat: update RAG, bulk remove attach file, route for workspace |
| `3c85f0e` | feat: drag and drop attachment file in chat section |
| `ab64107` | feat: share chat session and snapshot |
| `c8f8031` | feat: add session document expiry and cleanup lifecycle |
| `2ea1e83` | feat: update AI chatbot, multiple doc attach, implement chat session |
| `0ee7228` | feat: attach files to chat session |
| `c0a231c` | feat: Add document OCR, thumbnails, and extraction metadata |
| `59a9a10` | feat: stream workspace chat responses |
| `5527e00` | feat: persist RAG metadata and improve hybrid answers |
| `f83fa0a` | feat: add embedding step and fix reload workspace |
| `a7f04f0` | feat: add temporary RAG workspace with provider controls |
| `600d2fd` | feat: add thumbnail previews and real seed documents |
| `302e786` | refactor: migrate tailwind css, update logout/login/regis function |
| `83cb874` | feat: make UI for landingPage, login/regis page |

---

## 🏗️ 1. Middleware (Lớp Xác Thực & Kiểm Tra Quyền)

> Đây là lớp nền, được gọi trước tất cả các API handler.

### 📄 auth.js (`backend/src/middleware/auth.js`)

| Hàm | Chức năng |
|-----|-----------|
| `verifyToken(req, res, next)` | Middleware xác thực JWT: giải mã token từ header `Authorization`, kiểm tra hạn dùng (fast local check) → xác thực với Supabase Auth → đồng bộ profile người dùng vào `req.user` |

---

### 📄 requireDocumentOwner.js (`backend/src/middleware/requireDocumentOwner.js`)

| Hàm | Chức năng |
|-----|-----------|
| `requireDocumentOwner()` | Factory middleware kiểm tra quyền chủ sở hữu tài liệu: tra `document.user_id` hoặc `req.user.role === 'admin'` → gắn `req.document` nếu hợp lệ |

---

## 🔌 2. Services Nền Tảng (Utilities & Providers)

> Các service cấp thấp nhất, không phụ thuộc lẫn nhau.

### 📄 embedding.service.js (`backend/src/services/embedding.service.js`)

| Hàm | Chức năng |
|-----|-----------|
| `withTimeout(promise, timeoutMs)` | Bọc một Promise với timeout tự động từ chối nếu quá thời gian |
| `normalizeEmbedding(values)` | Kiểm tra và chuẩn hóa mảng số floating-point thành vector embedding đúng chiều |
| `extractEmbeddings(response)` | Trích xuất danh sách vector từ response của Gemini API |
| `embedTexts(texts, taskType)` | Gọi Gemini Embedding API theo batch để embed nhiều đoạn văn bản cùng lúc |
| `embedQuery(question)` | Embed một câu hỏi thành vector để tìm kiếm ngữ nghĩa |
| `embedChunks(chunks)` | Embed toàn bộ danh sách chunks văn bản (theo batch) và gắn `embeddingStatus` |
| `markChunksEmbeddingFailed(chunks, error)` | Đánh dấu `embeddingStatus: 'failed'` cho chunks khi gặp lỗi embedding |

---

### 📄 gemini.service.js (`backend/src/services/gemini.service.js`)

| Hàm | Chức năng |
|-----|-----------|
| `withTimeout(promise, timeoutMs)` | Bọc request Gemini với timeout, trả lỗi 503 nếu quá hạn |
| `extractUsageMetadata(response)` | Trích xuất thống kê token (promptTokens, completionTokens) từ response |
| `queryDocument(question, documentText)` | Gọi Gemini để trả lời câu hỏi từ toàn bộ nội dung tài liệu (mode đơn giản) |
| `buildModeInstruction(mode)` | Tạo instruction cho Gemini theo chế độ `hybrid` hoặc `document_only` |
| `buildFallbackPrompt(...)` | Tạo prompt dự phòng khi không có systemPrompt/userPrompt tùy chỉnh |
| `queryDocumentChunks(...)` | Gọi Gemini để trả lời từ danh sách chunks RAG, có hỗ trợ lịch sử hội thoại |
| `streamDocumentChunks(...)` | Phiên bản stream (SSE) của `queryDocumentChunks`, yield từng token text |

---

### 📄 ocr.service.js (`backend/src/services/ocr.service.js`)

| Hàm | Chức năng |
|-----|-----------|
| `getConfig()` | Đọc cấu hình OCR từ env (tesseract path, mutool path, ngôn ngữ, timeout) |
| `runLimited(task)` | Hàng đợi giới hạn số job OCR chạy đồng thời |
| `execFile(command, args, options)` | Bọc `child_process.execFile` với timeout |
| `extractTextFromPdfBuffer(buffer, options)` | Chuyển PDF sang ảnh PNG (dùng mutool) rồi OCR từng trang bằng Tesseract |
| `extractTextFromImageBuffer(buffer, mimeType)` | OCR trực tiếp từ buffer ảnh (PNG/JPEG/TIFF/BMP) |
| `extractTextFromBuffer(buffer, mimeType)` | Điểm vào: phân loại loại file rồi gọi hàm OCR phù hợp |

---

### 📄 rag.service.js (`backend/src/services/rag.service.js`)

> **RAG (Retrieval Augmented Generation)** – engine tìm kiếm và phân đoạn văn bản

| Hàm | Chức năng |
|-----|-----------|
| `extractRequirementIds(text)` | Trích xuất các ID yêu cầu (REQ, FR, NFR...) từ văn bản |
| `looksLikeHeading(line)` | Phát hiện liệu một dòng văn bản có phải là tiêu đề mục hay không |
| `inferSectionHeading(text, startChar)` | Suy luận tiêu đề của đoạn văn dựa trên ngữ cảnh xung quanh |
| `normalizeText(text)` | Chuẩn hóa khoảng trắng/xuống dòng trong văn bản |
| `estimateTokens(text)` | Ước tính số token từ số ký tự (4 ký tự ≈ 1 token) |
| `splitTextIntoChunks(text, metadata)` | Chia văn bản dài thành các chunk nhỏ có overlap, kèm metadata trang, heading, requirement IDs |
| `tokenize(text)` | Tách văn bản thành danh sách từ khoá, lọc stop words |
| `scoreChunk(questionTerms, chunk)` | Chấm điểm relevance của một chunk theo từ khoá câu hỏi |
| `rankRelevantChunks(question, chunks, limit)` | Xếp hạng chunks theo điểm từ khoá, trả về top-K |
| `retrieveRelevantChunks(question, chunks, limit)` | Lấy chunks liên quan nhất: ưu tiên matched, fallback chunk đầu mỗi tài liệu |
| `buildValidatedEvidence(chunks, documentsById)` | Xác thực ownership của từng chunk (doc_id, title phải khớp) trước khi đưa vào prompt |
| `buildSourcePayload(chunks, documentsById)` | Tạo danh sách source để trả về client sau khi đã validate |

---

## 🔗 3. Services Trung Tầng (Domain Logic)

> Gọi services nền tảng, chứa business logic chính.

### 📄 chat-context.service.js (`backend/src/services/chat-context.service.js`)

> Phân tích ngữ cảnh câu hỏi để định hướng RAG retrieval

| Hàm | Chức năng |
|-----|-----------|
| `detectPointCount(question)` | Phát hiện người dùng muốn "X ý" trong câu trả lời |
| `stripStudioMetaFromDisplay(text)` | Xóa metadata ẩn của Studio (quiz/flashcard) khỏi văn bản hiển thị |
| `detectQuizHelpConstraints(question)` | Phát hiện câu hỏi từ quiz AI và trích xuất đáp án đã lưu |
| `detectFlashcardHelpConstraints(question)` | Phát hiện câu hỏi từ flashcard AI và trích xuất gợi ý đáp án |
| `detectResponseConstraints(question)` | Tổng hợp: ngắn gọn, chỉ khác biệt, số điểm, cấu trúc (table/bullet/paragraph) |
| `mergeConstraints(previous, current, options)` | Kế thừa constraints từ lượt hội thoại trước nếu cần |
| `normalizeComparable(text)` | Chuẩn hóa tiếng Việt diacritics để so sánh pattern |
| `classifyImageQuestion(question)` | Phân loại câu hỏi liên quan đến ảnh: text OCR, visual, trắc nghiệm |
| `analyzeRequest(...)` | **Hàm chính**: phân tích intent (so sánh/tóm tắt/hỏi đáp thường), xác định document được nhắc đến, lịch sử, constraints |
| `resolveDocumentScope(...)` | Xác định tài liệu nào sẽ được dùng cho retrieval (general/explicit_single/explicit_multi/ambiguous) |
| `findInheritedImageTask(history, question)` | Tìm task ảnh OCR từ lịch sử hội thoại để kế thừa context |
| `buildComparisonUnavailableAnswer(question)` | Tạo câu trả lời thông báo không đủ tài liệu để so sánh |

---

### 📄 document.service.js (`backend/src/services/document.service.js`)

| Hàm | Chức năng |
|-----|-----------|
| `mapDocument(doc)` | Chuẩn hóa document record từ DB, flatten tags |
| `filterDocuments(documents, { search, subjectId })` | Lọc danh sách tài liệu theo từ khoá tìm kiếm và môn học |
| `normalizePreviewText(text)` | Cắt ngắn text preview tối đa 150 ký tự |
| `getDocumentFileType(doc)` | Xác định loại file (PDF/DOCX/TXT/IMAGE) từ MIME type |
| `buildPublicDocumentPreview(doc)` | Tạo payload preview công khai của tài liệu |
| `canUseDocumentInChat(userId, docId)` | Kiểm tra quyền dùng tài liệu trong chat (chủ sở hữu, công khai, hoặc được chia sẻ) |
| `canAttachDocumentToSession(userId, docId)` | Kiểm tra quyền đính kèm tài liệu vào session chat |
| `addThumbnailUrls(documents)` | Gắn signed URL thumbnail vào danh sách tài liệu |

---

### 📄 document-overview.service.js (`backend/src/services/document-overview.service.js`)

| Hàm | Chức năng |
|-----|-----------|
| `isLowInformation(content)` | Kiểm tra chunk có đủ nội dung để tóm tắt không |
| `pickSpaced(chunks, count)` | Chọn các chunk phân bổ đều từ đầu đến cuối tài liệu |
| `selectRepresentativeChunks(chunks, options)` | Chọn bộ chunks đại diện để tóm tắt toàn tài liệu |
| `generateOverviewBestEffort(...)` | Dùng AI (Gemini/Ollama) tạo overview (tóm tắt, chủ đề, outline) cho tài liệu, không block nếu lỗi |
| `markStaleBestEffort(documentId)` | Đánh dấu overview cũ khi tài liệu được cập nhật |
| `retryOverview(...)` | Tạo lại overview khi bị lỗi trước đó |

---

### 📄 document-roadmap.service.js (`backend/src/services/document-roadmap.service.js`)

> Tạo lộ trình học tập từ nội dung tài liệu

| Hàm | Chức năng |
|-----|-----------|
| `stripJsonFence(text)` | Loại bỏ fence markdown code block json khỏi chuỗi JSON trả về từ AI |
| `extractTopLevelJsonObject(text)` | Trích xuất JSON object đầu tiên từ chuỗi văn bản |
| `generateRoadmapBestEffort(...)` | Gọi AI tạo lộ trình học dạng JSON ({title, goal, steps[]}), không block nếu lỗi |
| `markStaleBestEffort(documentId)` | Đánh dấu roadmap cũ khi tài liệu thay đổi |
| `retryRoadmap(...)` | Tạo lại roadmap khi bị lỗi |

---

### 📄 verification.service.js (`backend/src/services/verification.service.js`)

> Lớp kiểm chứng tính xác thực của bằng chứng RAG **trước khi** AI sinh câu trả lời

| Hàm | Chức năng |
|-----|-----------|
| `shouldVerify(question, requestContext, answerMode)` | Xác định có cần kiểm chứng không: chỉ verify câu hỏi thực tế (factual), không verify đọc/tóm tắt |
| `verifyEvidenceSafe(...)` | Entry point: gọi verifier Ollama, không bao giờ block câu trả lời chính nếu gặp lỗi |
| `buildVerificationBadge(verdict)` | Tạo badge nhỏ gắn vào câu trả lời: ✅ verified / ⚠️ uncertain / ❌ contradicted |

---

### 📄 chat.service.js (`backend/src/services/chat.service.js`)

> Quản lý toàn bộ vòng đời chat session và tin nhắn

| Hàm | Chức năng |
|-----|-----------|
| `cleanMessage(content)` | Validate và trim nội dung tin nhắn (tối đa 4000 ký tự) |
| `cleanSessionTitle(title, fallback)` | Validate và trim tiêu đề session |
| `buildChatDocumentPreview(doc)` | Tạo payload preview tài liệu kèm lifecycle info (expires_at, can_restore...) |
| `buildSessionPayload(session, documents, messages, canWrite, recoverableDocuments)` | Đóng gói toàn bộ dữ liệu session để trả về client |
| `canReadChatSession(userId, sessionId)` | Kiểm tra quyền đọc session (chủ sở hữu hoặc được chia sẻ) |
| `canWriteChatSession(userId, sessionId)` | Kiểm tra quyền ghi session (chỉ chủ sở hữu) |
| `listActiveSessionAttachments(...)` | Lấy danh sách tài liệu đang đính kèm trong session |
| `findActiveSessionAttachment(...)` | Tìm một tài liệu cụ thể trong session |
| `reattachSessionDocuments(...)` | Khôi phục tài liệu đã bị gỡ khỏi session |
| `softRemoveSessionAttachment(...)` | Gỡ (soft-delete) tài liệu khỏi session |
| `buildChatContext(documents)` | Ghép extracted_text của các tài liệu thành context string cho AI |
| `mapSessionSummary(session)` | Map DB record session thành payload tóm tắt (có đếm attachments) |
| `listSessions(...)` | Lấy danh sách chat sessions của user theo tài liệu |
| `createSession(...)` | Tạo session mới, tự đính kèm tài liệu chính, log activity |
| `renameSession(...)` | Đổi tên session, log activity |
| `deleteSession(...)` | Soft-delete session, log activity |
| `getOrCreateSession(...)` | Lấy session gần nhất hoặc tạo mới nếu chưa có |
| `getMessages(...)` | Lấy tin nhắn + tài liệu + recoverable docs của session, refresh session-scoped expiry |
| `sendMessage(...)` | Gửi tin nhắn, gọi Gemini, lưu cả user message và assistant reply |
| `shareSessionWithUser(...)` | Chia sẻ session với user khác |
| `removeUserShare(...)` | Thu hồi quyền chia sẻ với user cụ thể |
| `createPublicLink()` | (Disabled) Tạo link công khai – đã chuyển sang snapshot |
| `revokePublicLink(...)` | Thu hồi public link của session |

---

### 📄 session-attachment.service.js (`backend/src/services/session-attachment.service.js`)

> Xử lý đính kèm file vào chat session, bao gồm upload và auto-index

| Hàm | Chức năng |
|-----|-----------|
| `isAttachmentLimitError(error)` | Phát hiện lỗi DB khi vượt giới hạn 20 tài liệu/session |
| `attachmentLimitError()` | Tạo lỗi 409 với thông báo giới hạn đính kèm |
| `normalizeUploadRequestId(value)` | Validate UUID của upload request |
| `mapLifecycleConflict(error)` | Chuyển lỗi DB lifecycle thành HTTP error phù hợp |
| `requireOwnedSession(userId, sessionId)` | Đảm bảo session tồn tại và thuộc về user |
| `assertAttachmentSlotAvailable(sessionId)` | Kiểm tra session chưa đạt giới hạn tài liệu (20) |
| `attachWithLimitHandling(...)` | Đính kèm tài liệu vào session, bắt lỗi giới hạn |
| `getUpdatedSessionPayload(...)` | Làm mới payload session sau khi thay đổi |
| `attachmentProcessing(document, sessionId, processingError)` | Kiểm tra trạng thái indexing của tài liệu vừa đính kèm |
| `processSessionDocument(...)` | Claim + xử lý tài liệu session: extract text → embed chunks |
| `attachLibraryDocument(...)` | Đính kèm tài liệu từ thư viện cá nhân/public vào session |
| `attachUploadedFile(...)` | Upload file mới và đính kèm vào session ngay sau đó |
| `removeAttachments(...)` | Gỡ nhiều tài liệu cùng lúc khỏi session |

---

### 📄 session-document-lifecycle.service.js (`backend/src/services/session-document-lifecycle.service.js`)

> Tự động dọn dẹp tài liệu session-scoped hết hạn (cron job)

| Hàm | Chức năng |
|-----|-----------|
| `getDryRunSummary()` | Đếm số tài liệu sắp hết hạn/cần purge (không xóa thực) |
| `expireBatch(batchSize)` | Chuyển tài liệu hết hạn sang trạng thái `expired` qua RPC |
| `claimPurgeBatch(...)` | Claim một batch tài liệu `expired` để bắt đầu purge (distributed lock) |
| `releaseFailedPurgeClaim(...)` | Giải phóng claim nếu purge thất bại |
| `finalizePurge(document, claimToken)` | Hoàn tất purge: xóa chunks, storage, đánh dấu `purged` |
| `runLifecycleCycle(options)` | Chạy một vòng đầy đủ: expire → purge → cleanup storage |

---

### 📄 chat-snapshot.service.js (`backend/src/services/chat-snapshot.service.js`)

> Tạo và chia sẻ snapshot bất biến (immutable) của một cuộc hội thoại

| Hàm | Chức năng |
|-----|-----------|
| `featureEnabled()` | Kiểm tra feature flag `CHAT_SNAPSHOT_SHARING_ENABLED` |
| `tokenHash(token)` | Hash token chia sẻ bằng SHA-256 trước khi lưu DB |
| `createToken()` | Tạo random token base64url 32 bytes |
| `citationCounts(messages)` | Đếm số lần mỗi tài liệu được trích dẫn trong tin nhắn |
| `sanitizeMessageMetadata(metadata)` | Chỉ giữ lại metadata được phép (provider, model, mode) cho snapshot công khai |
| `sanitizePublicExcerpt(value, limit)` | Cắt ngắn và làm sạch excerpt trích dẫn công khai |
| `getShareOptions(...)` | Lấy danh sách tài liệu/citations để người dùng chọn khi tạo snapshot |
| `createSnapshot(...)` | Tạo snapshot bất biến: lưu messages, citations, tài liệu đã chọn |
| `listOwnedLinks(userId)` | Lấy danh sách snapshot links đã tạo của user |
| `disableLink(...)` | Vô hiệu hóa link chia sẻ |
| `updateLinkAccess(...)` | Cập nhật quyền truy cập (private/public) của link |
| `importSnapshot(...)` | Nhận link chia sẻ từ người khác, nhập vào danh sách received |
| `listSharedChats(userId)` | Danh sách chats đã chia sẻ hoặc nhận |
| `listSharedDocuments(userId)` | Danh sách tài liệu trong các snapshot đã nhận |
| `saveSharedDocumentToLibrary(...)` | Lưu tài liệu từ snapshot được chia sẻ vào thư viện cá nhân |

---

## 🤖 4. AI Service – Orchestrator Trung Tâm

> Điều phối toàn bộ luồng AI: validate input → RAG retrieval → generate answer → lưu DB

### 📄 ai.service.js (`backend/src/services/ai.service.js`) – 2040 dòng

#### 4.1 Utility Helpers

| Hàm | Chức năng |
|-----|-----------|
| `logImageOcrDebug(label, payload)` | Log debug OCR image (chỉ non-production) |
| `normalizeNumericId(value, fieldName)` | Validate ID là integer dương |
| `cleanQuestion(question)` | Validate và trim câu hỏi (tối đa 2000 ký tự) |
| `resolveStoredUserMessageContent(...)` | Chọn nội dung lưu vào DB cho user message (ưu tiên displayQuestion) |
| `normalizeAnswerMode(mode)` | Validate chế độ trả lời: `hybrid` hoặc `document_only` |
| `getMimeType(doc)` | Lấy MIME type của tài liệu từ cloud_files |
| `isImageDocument(doc)` | Phát hiện tài liệu là ảnh |
| `isOcrTextImageQuestion(type)` | Phát hiện câu hỏi yêu cầu đọc text từ ảnh qua OCR |
| `detectMultipleChoiceFromOcrChunks(chunks)` | Phát hiện câu hỏi trắc nghiệm trong OCR chunks |
| `estimatePromptTokens(...)` | Ước tính số token của prompt để kiểm tra quota trước khi gọi AI |

#### 4.2 Document Processing (Extract → Chunk → Embed)

| Hàm | Chức năng |
|-----|-----------|
| `extractTextFromStorage(doc)` | Tải file từ Supabase Storage → extract text (PDF/DOCX/TXT/image) |
| `getProcessableDocument(...)` | Tìm và validate tài liệu có thể xử lý bằng AI |
| `processDocument(...)` | **Pipeline chính**: extract text → split chunks → embed → tạo overview + roadmap |
| `safeTouchSession(sessionId)` | Cập nhật `last_activity_at` của session, không throw nếu lỗi |
| `getOrCreateChunksForAsk(...)` | Lấy chunks đã có, hoặc auto-process tài liệu nếu chưa có chunks |

#### 4.3 RAG Retrieval Helpers

| Hàm | Chức năng |
|-----|-----------|
| `getChunkKey(chunk)` | Tạo khóa duy nhất cho một chunk (dùng id hoặc doc:index) |
| `buildAuthorizedChunkIndex(chunks)` | Tạo index tra cứu nhanh chunks đã được authorize |
| `normalizeRetrievedChunksToAuthorizedScope(...)` | Map vector chunks trả về từ DB vào chunks đã có quyền truy cập |
| `mergeHybridChunks(...)` | Kết hợp kết quả vector search + keyword search theo trọng số (0.7/0.3) |
| `retrieveChunksForQuestion(...)` | Hybrid retrieval: embedding vector search + keyword fallback |
| `retrieveCoveredChunksForQuestion(...)` | Retrieval cho multi-document: đảm bảo mỗi tài liệu có coverage |
| `allocateDocumentCoverage(...)` | Phân bổ chunk budget đều giữa các tài liệu |
| `filterDocumentsByIds(documents, documentIds)` | Lọc danh sách tài liệu theo ID |
| `filterChunksByDocumentIds(chunks, documentIds)` | Lọc chunks theo tài liệu |

#### 4.4 Response Builders

| Hàm | Chức năng |
|-----|-----------|
| `buildAssistantMetadata(...)` | Tạo metadata cho assistant message (provider, model, sources, verification) |
| `buildAmbiguousDocumentAnswer(...)` | Trả lời khi câu hỏi không rõ tài liệu nào được nhắc đến |
| `buildImageOcrLimitationAnswer(question)` | Trả lời khi ảnh không có text đọc được |
| `buildImageVisualLimitationAnswer(question)` | Trả lời khi câu hỏi về nội dung visual chưa hỗ trợ |
| `buildScopeResponse(...)` | Đóng gói toàn bộ response trả về client: answer, sources, session, documents, usage |
| `saveSystemAskResponse(...)` | Lưu câu trả lời system (không qua AI) vào DB |
| `saveAssistantAnswer(...)` | Lưu câu trả lời AI vào DB kèm metadata |
| `detectOverviewIntent(...)` | Phát hiện câu hỏi tóm tắt toàn tài liệu / so sánh overview |
| `formatOverviewRecord(...)` | Format overview record thành text đưa vào prompt |
| `buildOverviewEvidence(...)` | Lấy overview + source chunks cho retrieval intent tóm tắt |

#### 4.5 Session Resolution

| Hàm | Chức năng |
|-----|-----------|
| `isDocumentReadyForRag(doc)` | Kiểm tra tài liệu đã sẵn sàng dùng RAG chưa |
| `canAutoProcessDocumentForUser(doc, userId)` | Kiểm tra có thể auto-process tài liệu cho user không |
| `canUseDocumentThroughOwnedSession(...)` | Kiểm tra quyền dùng tài liệu thông qua session đang chat |
| `resolveAuthorizedSessionDocuments(...)` | Lấy tất cả tài liệu authorized trong session, phân loại excluded |
| `resolveAskScope(...)` | Xác định scope của request (session hoặc single document) |
| `loadSessionChunks(...)` | Load chunks của tất cả tài liệu trong scope, auto-process nếu cần |

#### 4.6 Main Ask Pipeline

| Hàm | Chức năng |
|-----|-----------|
| `prepareAsk(...)` | **Phase 1**: Chuẩn bị context: validate → resolve scope → analyze intent → retrieve chunks → validate ownership → kiểm tra quota |
| `executeAsk(...)` | **Phase 2** (non-stream): gọi AI generate → log usage → save messages → return response |
| `executeAskStream(...)` | **Phase 2** (stream): yield token qua SSE, sau đó send `done` event |
| `askDocument(args)` | Entry point: hỏi AI về một tài liệu đơn (non-stream) |
| `askDocumentStream(args)` | Entry point: stream câu trả lời từ một tài liệu đơn |
| `askSession(args)` | Entry point: hỏi AI trong ngữ cảnh session nhiều tài liệu (non-stream) |
| `askSessionStream(args)` | Entry point: stream câu trả lời trong session |

#### 4.7 Roadmap & Overview Management

| Hàm | Chức năng |
|-----|-----------|
| `retryDocumentOverview(...)` | Tạo lại AI overview của tài liệu |
| `resolveRoadmapDocument(...)` | Helper: lấy tài liệu với fallback cho session-scoped docs |
| `getDocumentRoadmap(...)` | Lấy roadmap học tập + các bước đã hoàn thành của user |
| `retryDocumentRoadmap(...)` | Tạo lại roadmap học tập |
| `listRoadmapsInProgress(...)` | Liệt kê các roadmap đang học dở (widget "Tiếp tục học") |
| `toggleRoadmapStep(...)` | Đánh dấu hoàn thành/chưa hoàn thành một bước học |

---

## 🌐 5. Controllers (HTTP Handler)

> Nhận request HTTP, gọi service, trả response. Không chứa business logic.

### 📄 ai.controller.js (`backend/src/controllers/ai.controller.js`)

| Hàm | Route tương ứng | Chức năng |
|-----|----------------|-----------|
| `processDocument` | POST /ai/documents/:id/process | Trigger extract + embed tài liệu |
| `retryDocumentOverview` | POST /ai/documents/:id/overview/retry | Tạo lại AI overview |
| `getDocumentRoadmap` | GET /ai/documents/:id/roadmap | Lấy roadmap học tập |
| `retryDocumentRoadmap` | POST /ai/documents/:id/roadmap/retry | Tạo lại roadmap |
| `toggleRoadmapStep` | PATCH /ai/documents/:id/roadmap/steps/:stepOrder | Tick/untick bước học |
| `listRoadmapsInProgress` | GET /ai/roadmaps/in-progress | Widget roadmap đang học |
| `askDocument` | POST /ai/documents/:id/ask | Hỏi AI (non-stream) |
| `askDocumentStream` | POST /ai/documents/:id/ask/stream | Hỏi AI (SSE stream) |
| `askSession` | POST /ai/sessions/:sessionId/ask | Hỏi AI session (non-stream) |
| `askSessionStream` | POST /ai/sessions/:sessionId/ask/stream | Hỏi AI session (SSE stream) |
| `getUsage` | GET /ai/usage | Lấy quota và usage hiện tại |
| `getModelStatus` | GET /ai/status | Trạng thái Gemini và Ollama |
| `getMaterials` | GET /ai/materials | Lấy study materials đã tạo |
| `generateMaterial` | POST /ai/materials | Tạo flashcard/quiz/mindmap từ AI |
| `deleteMaterial` | DELETE /ai/materials/:id | Xóa study material |

---

### 📄 chat.controller.js (`backend/src/controllers/chat.controller.js`)

| Hàm | Chức năng |
|-----|-----------|
| `getOrCreateSession` | Lấy hoặc tạo session mới theo docId |
| `getMessages` | Lấy tin nhắn và tài liệu của session |
| `sendMessage` | Gửi tin nhắn (legacy, không dùng RAG) |
| `shareSessionWithUser` | Chia sẻ session với user khác |
| `removeUserShare` | Thu hồi chia sẻ |
| `createPublicLink` | (Disabled) Tạo link public |
| `revokePublicLink` | Thu hồi link public |
| `listSessions` | Liệt kê sessions |
| `createSession` | Tạo session mới |
| `renameSession` | Đổi tên session |
| `deleteSession` | Xóa session |
| `attachLibraryDocument` | Đính kèm file từ thư viện |
| `attachUploadedFile` | Upload và đính kèm file mới |
| `removeAttachments` | Gỡ tài liệu khỏi session |
| `reattachDocuments` | Khôi phục tài liệu đã gỡ |

---

### 📄 chat-snapshot.controller.js (`backend/src/controllers/chat-snapshot.controller.js`)

| Hàm | Chức năng |
|-----|-----------|
| `getShareOptions` | Xem options trước khi tạo snapshot |
| `createSnapshot` | Tạo snapshot bất biến |
| `listOwnedLinks` | Danh sách link đã tạo |
| `disableLink` | Vô hiệu hóa link |
| `updateLinkAccess` | Cập nhật quyền truy cập link |
| `registerRecipientOpen` | Ghi nhận người nhận đã mở link |
| `listReceivedLinks` | Danh sách link đã nhận |
| `removeReceivedLink` | Xóa link đã nhận |
| `importSnapshot` | Nhập snapshot từ link |
| `downloadSnapshotDocument` | Tải tài liệu trong snapshot |
| `listSharedChats` | Danh sách chat đã chia sẻ |
| `listSharedDocuments` | Danh sách tài liệu trong snapshot |
| `downloadSharedDocument` | Tải tài liệu từ snapshot |
| `saveSharedDocument` | Lưu tài liệu vào thư viện |

---

## 🎨 6. Frontend Components (Workspace UI)

### 📄 AIChatPanel.jsx (`frontend/src/components/workspace/AIChatPanel.jsx`)

| Component/Function | Chức năng |
|-------------------|-----------|
| `usagePercent(used, limit)` | Tính phần trăm sử dụng quota |
| `usageBarClass(percent)` | Trả màu progress bar theo ngưỡng (xanh/cam/đỏ) |
| `UsageRow` | Hiển thị một dòng thống kê usage với progress bar |
| `UsagePopover` | Popup hover hiện quota chi tiết (requests/day, tokens/min...) |
| `SourceList` | Hiển thị danh sách nguồn trích dẫn (sources) của câu trả lời AI, group theo tài liệu |
| `VerificationBadge` | Hiển thị badge kiểm chứng (verified/uncertain/contradicted) |
| `MessageBubble` | Render một tin nhắn chat (user/assistant), hỗ trợ markdown, copy, sources |
| `SuggestedQuestions` | Gợi ý câu hỏi mặc định khi session mới tạo |
| `ModelSelector` | Dropdown chọn AI model (Gemini Flash, Pro, Ollama) |
| `AIChatPanel` | **Component chính**: toàn bộ panel chat AI gồm header, lịch sử tin nhắn, input box, model selector, streaming SSE |

---

### 📄 ChatAttachmentBar.jsx (`frontend/src/components/workspace/ChatAttachmentBar.jsx`)

| Component | Chức năng |
|-----------|-----------|
| `ChatAttachmentBar` | Thanh quản lý tài liệu đính kèm: upload (drag & drop, browse), gỡ, khôi phục, hiển thị trạng thái indexing của từng file |

---

### 📄 ChatSessionMenu.jsx (`frontend/src/components/workspace/ChatSessionMenu.jsx`)

| Component | Chức năng |
|-----------|-----------|
| `ChatSessionMenu` | Panel quản lý các chat session: tạo mới, chọn, đổi tên, xóa session |

---

### 📄 ChatShareModal.jsx (`frontend/src/components/workspace/ChatShareModal.jsx`)

| Component | Chức năng |
|-----------|-----------|
| `ChatShareModal` | Modal tạo và quản lý snapshot chia sẻ: chọn tài liệu đính kèm, tạo link, copy link |

---

### 📄 WorkspaceRoadmapView.jsx (`frontend/src/components/workspace/WorkspaceRoadmapView.jsx`)

| Component | Chức năng |
|-----------|-----------|
| `WorkspaceRoadmapView` | Hiển thị lộ trình học tập được AI tạo ra: danh sách bước, tiến độ hoàn thành, câu hỏi gợi ý, toggle hoàn thành từng bước |

---

## 📊 Sơ Đồ Luồng Chính: Người Dùng Hỏi AI

```
User gửi câu hỏi
    │
    ▼
AIChatPanel.jsx (Frontend)
    │ SSE request
    ▼
ai.controller.js → askDocumentStream / askSessionStream
    │
    ▼
ai.service.js → executeAskStream()
    │
    ├─► prepareAsk()
    │       ├── cleanQuestion()
    │       ├── resolveAskScope() → chat.service.getOrCreateSession()
    │       ├── chat-context.service.analyzeRequest()  [intent, scope]
    │       ├── loadSessionChunks() → processDocument() nếu cần
    │       │       └── extractTextFromStorage → rag.service.splitTextIntoChunks
    │       │               └── embedding.service.embedChunks (Gemini API)
    │       ├── retrieveChunksForQuestion()
    │       │       ├── embedding.service.embedQuery (vector search)
    │       │       └── rag.service.retrieveRelevantChunks (keyword)
    │       │               └── mergeHybridChunks (0.7 vector + 0.3 keyword)
    │       └── rag.service.buildValidatedEvidence() [security check]
    │
    ├─► verification.service.verifyEvidenceSafe() [Ollama]
    │
    └─► aiProviderService.streamAnswer() [Gemini / Ollama]
            │ stream tokens via SSE
            ▼
        saveAssistantAnswer() → chatModel.addMessage()
            │
            ▼
        sendEvent('done', buildScopeResponse())
```

---

## 📌 Tổng Kết Vai Trò

- **quocdat2601** là tác giả chính của toàn bộ **AI pipeline** trong dự án, từ RAG retrieval, embedding, streaming SSE, đến verification layer.
- Các module chính do quocdat xây dựng từ đầu: `chat-context.service.js`, `ai.service.js`, `embedding.service.js`, `rag.service.js`, `verification.service.js`, `session-attachment.service.js`, `session-document-lifecycle.service.js`, `chat-snapshot.service.js`.
- Frontend workspace (`AIChatPanel.jsx`, `ChatAttachmentBar.jsx`, `WorkspaceRoadmapView.jsx`) cũng được quocdat thiết kế và phát triển.
- Tổng cộng: **~80 hàm/functions** trải rộng trên **~15 file backend** và **~5 component frontend chính**.
