window.ArchiviaData = {
  students: [
    {
      id: 1,
      studentId: 'SPED-2026-001',
      firstName: 'Maria',
      lastName: 'Santos',
      batchYear: 2026,
      gradeLevel: 'Grade 7',
      section: 'Hope',
      disabilityType: 'Learning Disability',
      status: 'ACTIVE',
      createdAt: '2026-02-11T08:20:00Z'
    },
    {
      id: 2,
      studentId: 'SPED-2026-002',
      firstName: 'John',
      lastName: 'Dela Cruz',
      batchYear: 2026,
      gradeLevel: 'Grade 5',
      section: 'Unity',
      disabilityType: 'Autism Spectrum Disorder',
      status: 'ACTIVE',
      createdAt: '2026-02-10T09:10:00Z'
    },
    {
      id: 3,
      studentId: 'SPED-2025-003',
      firstName: 'Angela',
      lastName: 'Reyes',
      batchYear: 2025,
      gradeLevel: 'Grade 6',
      section: 'Compassion',
      disabilityType: 'Hearing Impairment',
      status: 'ARCHIVED',
      createdAt: '2026-01-25T13:45:00Z'
    }
  ],
  documents: [
    {
      id: 1001,
      studentId: 1,
      originalName: 'IEP-Plan-Term-1.pdf',
      filePath: 'storage/uploads/iep-plan-term-1.pdf',
      mimeType: 'application/pdf',
      fileSize: 328441,
      uploadedBy: 1,
      createdAt: '2026-02-07T07:30:00Z'
    },
    {
      id: 1002,
      studentId: 1,
      originalName: 'Psychological-Evaluation.pdf',
      filePath: 'storage/uploads/psychological-evaluation.pdf',
      mimeType: 'application/pdf',
      fileSize: 512980,
      uploadedBy: 1,
      createdAt: '2026-01-29T10:00:00Z'
    },
    {
      id: 1003,
      studentId: 2,
      originalName: 'Medical-Clearance.pdf',
      filePath: 'storage/uploads/medical-clearance.pdf',
      mimeType: 'application/pdf',
      fileSize: 198421,
      uploadedBy: 2,
      createdAt: '2026-02-05T08:45:00Z'
    }
  ],
  users: [
    { id: 1, name: 'ARCHIVIA Admin', email: 'admin@archivia.edu', role: 'ADMIN', createdAt: '2026-01-01T00:00:00Z' },
    { id: 2, name: 'Sofia Ramos', email: 's.ramos@archivia.edu', role: 'TEACHER', createdAt: '2026-01-05T00:00:00Z' },
    { id: 3, name: 'Miguel Cruz', email: 'm.cruz@archivia.edu', role: 'TEACHER', createdAt: '2026-01-07T00:00:00Z' },
    { id: 4, name: 'Lea Navarro', email: 'l.navarro@archivia.edu', role: 'TEACHER', createdAt: '2026-01-08T00:00:00Z' }
  ],
  logs: [
    { time: '2026-02-13 08:44', actor: 'Admin', userName: 'Admin', action: 'Updated student profile', target: 'SPED-2026-001', entityType: 'STUDENT' },
    { time: '2026-02-13 08:30', actor: 'Ms. Ramos', userName: 'Ms. Ramos', action: 'Viewed document', target: 'DOC-1001', entityType: 'DOCUMENT' },
    { time: '2026-02-13 08:10', actor: 'Admin', userName: 'Admin', action: 'Added teacher account', target: 'T-0004', entityType: 'USER' }
  ]
};
