-- Demo data for AI Study Hub.
-- Run after migrations in the Supabase SQL Editor.
-- This seed is idempotent and attaches sample content to existing active users.

DO $$
DECLARE
  admin_id users.id%TYPE;
  student_id users.id%TYPE;
  swp_id subjects.id%TYPE;
  dbi_id subjects.id%TYPE;
  prn_id subjects.id%TYPE;
  ai_id subjects.id%TYPE;
  mae_id subjects.id%TYPE;
  seed_doc_id documents.id%TYPE;
  seed_file_id cloud_files.id%TYPE;
  seed_session_id chat_sessions.id%TYPE;
BEGIN
  SELECT id INTO admin_id
  FROM users
  WHERE role = 'admin' AND status = 'active'
  ORDER BY created_at
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Seed requires at least one active admin user in users table.';
  END IF;

  SELECT id INTO student_id
  FROM users
  WHERE role = 'student' AND status = 'active'
  ORDER BY created_at
  LIMIT 1;

  IF student_id IS NULL THEN
    RAISE EXCEPTION 'Seed requires at least one active student user in users table.';
  END IF;

  INSERT INTO subjects (code, name, description, created_by)
  VALUES ('SWP391', 'Software Project', 'Software project planning, requirements, and delivery practices.', admin_id)
  ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        updated_at = NOW()
  RETURNING id INTO swp_id;

  INSERT INTO subjects (code, name, description, created_by)
  VALUES ('DBI202', 'Database Systems', 'Relational design, SQL, normalization, and transactions.', admin_id)
  ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        updated_at = NOW()
  RETURNING id INTO dbi_id;

  INSERT INTO subjects (code, name, description, created_by)
  VALUES ('PRN212', 'C# Desktop Applications', 'C# programming, WPF, MVVM, and application structure.', admin_id)
  ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        updated_at = NOW()
  RETURNING id INTO prn_id;

  INSERT INTO subjects (code, name, description, created_by)
  VALUES ('AI101', 'AI Fundamentals', 'Prompting, model behavior, and applied AI study workflows.', admin_id)
  ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        updated_at = NOW()
  RETURNING id INTO ai_id;

  INSERT INTO subjects (code, name, description, created_by)
  VALUES ('MAE101', 'Calculus and Algebra', 'Core math practice for engineering and computing students.', admin_id)
  ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        updated_at = NOW()
  RETURNING id INTO mae_id;

  SELECT id INTO seed_doc_id FROM documents WHERE user_id = student_id AND title = 'SWP391 Requirement Engineering Notes' LIMIT 1;
  IF seed_doc_id IS NULL THEN
    INSERT INTO cloud_files (storage_path, mime_type, size_bytes)
    VALUES ('demo/' || student_id || '/swp391-requirement-engineering.pdf', 'application/pdf', 2432000)
    RETURNING id INTO seed_file_id;

    INSERT INTO documents (title, user_id, subject_id, file_id, status, extracted_text, extraction_status, extracted_at, view_count, created_at, updated_at)
    VALUES (
      'SWP391 Requirement Engineering Notes',
      student_id,
      swp_id,
      seed_file_id,
      'indexed',
      'Requirements engineering covers stakeholder analysis, functional requirements, non-functional requirements, user stories, acceptance criteria, and traceability matrices.',
      'ready',
      NOW(),
      128,
      NOW() - INTERVAL '6 days',
      NOW()
    )
    RETURNING id INTO seed_doc_id;
  ELSE
    UPDATE documents
    SET subject_id = swp_id,
        status = 'indexed',
        extraction_status = 'ready',
        extracted_text = 'Requirements engineering covers stakeholder analysis, functional requirements, non-functional requirements, user stories, acceptance criteria, and traceability matrices.',
        extracted_at = NOW(),
        view_count = GREATEST(COALESCE(view_count, 0), 128),
        updated_at = NOW()
    WHERE id = seed_doc_id;
  END IF;
  INSERT INTO bookmarks (user_id, doc_id)
  SELECT student_id, seed_doc_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM bookmarks
    WHERE bookmarks.user_id = student_id
      AND bookmarks.doc_id = seed_doc_id
  );

  SELECT id INTO seed_doc_id FROM documents WHERE user_id = student_id AND title = 'DBI202 Normalization and SQL Review' LIMIT 1;
  IF seed_doc_id IS NULL THEN
    INSERT INTO cloud_files (storage_path, mime_type, size_bytes)
    VALUES ('demo/' || student_id || '/dbi202-normalization-review.pdf', 'application/pdf', 1887000)
    RETURNING id INTO seed_file_id;

    INSERT INTO documents (title, user_id, subject_id, file_id, status, extracted_text, extraction_status, extracted_at, view_count, created_at, updated_at)
    VALUES (
      'DBI202 Normalization and SQL Review',
      student_id,
      dbi_id,
      seed_file_id,
      'indexed',
      'Database normalization reduces redundancy through first, second, and third normal forms. SQL joins combine related tables using keys and constraints.',
      'ready',
      NOW(),
      96,
      NOW() - INTERVAL '5 days',
      NOW()
    )
    RETURNING id INTO seed_doc_id;
  ELSE
    UPDATE documents
    SET subject_id = dbi_id,
        status = 'indexed',
        extraction_status = 'ready',
        extracted_text = 'Database normalization reduces redundancy through first, second, and third normal forms. SQL joins combine related tables using keys and constraints.',
        extracted_at = NOW(),
        view_count = GREATEST(COALESCE(view_count, 0), 96),
        updated_at = NOW()
    WHERE id = seed_doc_id;
  END IF;
  INSERT INTO bookmarks (user_id, doc_id)
  SELECT student_id, seed_doc_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM bookmarks
    WHERE bookmarks.user_id = student_id
      AND bookmarks.doc_id = seed_doc_id
  );

  SELECT id INTO seed_doc_id FROM documents WHERE user_id = student_id AND title = 'PRN212 WPF MVVM Final Checklist' LIMIT 1;
  IF seed_doc_id IS NULL THEN
    INSERT INTO cloud_files (storage_path, mime_type, size_bytes)
    VALUES ('demo/' || student_id || '/prn212-mvvm-checklist.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 934000)
    RETURNING id INTO seed_file_id;

    INSERT INTO documents (title, user_id, subject_id, file_id, status, extracted_text, extraction_status, extracted_at, view_count, created_at, updated_at)
    VALUES (
      'PRN212 WPF MVVM Final Checklist',
      student_id,
      prn_id,
      seed_file_id,
      'indexed',
      'MVVM separates views, view models, and models. Commands, data binding, observable collections, and validation keep WPF screens maintainable.',
      'ready',
      NOW(),
      74,
      NOW() - INTERVAL '4 days',
      NOW()
    )
    RETURNING id INTO seed_doc_id;
  ELSE
    UPDATE documents
    SET subject_id = prn_id,
        status = 'indexed',
        extraction_status = 'ready',
        extracted_text = 'MVVM separates views, view models, and models. Commands, data binding, observable collections, and validation keep WPF screens maintainable.',
        extracted_at = NOW(),
        view_count = GREATEST(COALESCE(view_count, 0), 74),
        updated_at = NOW()
    WHERE id = seed_doc_id;
  END IF;

  SELECT id INTO seed_doc_id FROM documents WHERE user_id = student_id AND title = 'AI101 Prompting Study Companion Guide' LIMIT 1;
  IF seed_doc_id IS NULL THEN
    INSERT INTO cloud_files (storage_path, mime_type, size_bytes)
    VALUES ('demo/' || student_id || '/ai101-prompting-guide.pdf', 'application/pdf', 1210000)
    RETURNING id INTO seed_file_id;

    INSERT INTO documents (title, user_id, subject_id, file_id, status, extracted_text, extraction_status, extracted_at, view_count, created_at, updated_at)
    VALUES (
      'AI101 Prompting Study Companion Guide',
      student_id,
      ai_id,
      seed_file_id,
      'indexed',
      'Effective study prompts provide context, ask for examples, request step-by-step reasoning, and verify understanding with practice questions.',
      'ready',
      NOW(),
      142,
      NOW() - INTERVAL '3 days',
      NOW()
    )
    RETURNING id INTO seed_doc_id;
  ELSE
    UPDATE documents
    SET subject_id = ai_id,
        status = 'indexed',
        extraction_status = 'ready',
        extracted_text = 'Effective study prompts provide context, ask for examples, request step-by-step reasoning, and verify understanding with practice questions.',
        extracted_at = NOW(),
        view_count = GREATEST(COALESCE(view_count, 0), 142),
        updated_at = NOW()
    WHERE id = seed_doc_id;
  END IF;
  INSERT INTO bookmarks (user_id, doc_id)
  SELECT student_id, seed_doc_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM bookmarks
    WHERE bookmarks.user_id = student_id
      AND bookmarks.doc_id = seed_doc_id
  );

  SELECT id INTO seed_doc_id FROM documents WHERE user_id = student_id AND title = 'MAE101 Integration Practice Pack' LIMIT 1;
  IF seed_doc_id IS NULL THEN
    INSERT INTO cloud_files (storage_path, mime_type, size_bytes)
    VALUES ('demo/' || student_id || '/mae101-integration-practice.pdf', 'application/pdf', 1653000)
    RETURNING id INTO seed_file_id;

    INSERT INTO documents (title, user_id, subject_id, file_id, status, extracted_text, extraction_status, extracted_at, view_count, created_at, updated_at)
    VALUES (
      'MAE101 Integration Practice Pack',
      student_id,
      mae_id,
      seed_file_id,
      'indexed',
      'Integration techniques include substitution, integration by parts, partial fractions, trigonometric identities, and improper integral checks.',
      'ready',
      NOW(),
      53,
      NOW() - INTERVAL '2 days',
      NOW()
    )
    RETURNING id INTO seed_doc_id;
  ELSE
    UPDATE documents
    SET subject_id = mae_id,
        status = 'indexed',
        extraction_status = 'ready',
        extracted_text = 'Integration techniques include substitution, integration by parts, partial fractions, trigonometric identities, and improper integral checks.',
        extracted_at = NOW(),
        view_count = GREATEST(COALESCE(view_count, 0), 53),
        updated_at = NOW()
    WHERE id = seed_doc_id;
  END IF;

  SELECT id INTO seed_doc_id FROM documents WHERE user_id = student_id AND title = 'Software Testing Final Review' LIMIT 1;
  IF seed_doc_id IS NULL THEN
    INSERT INTO cloud_files (storage_path, mime_type, size_bytes)
    VALUES ('demo/' || student_id || '/software-testing-final-review.pdf', 'application/pdf', 2115000)
    RETURNING id INTO seed_file_id;

    INSERT INTO documents (title, user_id, subject_id, file_id, status, extracted_text, extraction_status, extracted_at, view_count, created_at, updated_at)
    VALUES (
      'Software Testing Final Review',
      student_id,
      swp_id,
      seed_file_id,
      'indexed',
      'Testing strategy includes unit tests, integration tests, acceptance tests, regression checks, boundary values, and defect reporting workflow.',
      'ready',
      NOW(),
      67,
      NOW() - INTERVAL '1 day',
      NOW()
    )
    RETURNING id INTO seed_doc_id;
  ELSE
    UPDATE documents
    SET subject_id = swp_id,
        status = 'indexed',
        extraction_status = 'ready',
        extracted_text = 'Testing strategy includes unit tests, integration tests, acceptance tests, regression checks, boundary values, and defect reporting workflow.',
        extracted_at = NOW(),
        view_count = GREATEST(COALESCE(view_count, 0), 67),
        updated_at = NOW()
    WHERE id = seed_doc_id;
  END IF;

  SELECT id INTO seed_session_id
  FROM chat_sessions
  WHERE user_id = student_id AND title = 'Demo study chat'
  LIMIT 1;

  IF seed_session_id IS NULL THEN
    INSERT INTO chat_sessions (user_id, title, created_at, last_activity_at, updated_at)
    VALUES (student_id, 'Demo study chat', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours')
    RETURNING id INTO seed_session_id;
  END IF;

  INSERT INTO chat_session_documents (session_id, doc_id)
  SELECT seed_session_id, d.id
  FROM documents d
  WHERE d.user_id = student_id
    AND d.title IN ('SWP391 Requirement Engineering Notes', 'AI101 Prompting Study Companion Guide')
  ON CONFLICT (session_id, doc_id) DO NOTHING;

  INSERT INTO chat_messages (session_id, role, content, created_at)
  SELECT seed_session_id, 'user', 'Summarize the main idea of requirement traceability.', NOW() - INTERVAL '2 hours'
  WHERE NOT EXISTS (
    SELECT 1 FROM chat_messages
    WHERE chat_messages.session_id = seed_session_id
      AND content = 'Summarize the main idea of requirement traceability.'
  );

  INSERT INTO chat_messages (session_id, role, content, created_at)
  SELECT seed_session_id, 'assistant', 'Requirement traceability connects each requirement to its source, implementation, and test evidence so changes can be managed safely.', NOW() - INTERVAL '115 minutes'
  WHERE NOT EXISTS (
    SELECT 1 FROM chat_messages
    WHERE chat_messages.session_id = seed_session_id
      AND content = 'Requirement traceability connects each requirement to its source, implementation, and test evidence so changes can be managed safely.'
  );
END $$;
