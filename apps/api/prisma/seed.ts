import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Next Gen Buildathon database...');

  // ── Super Admin ─────────────────────────────────────
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'annapparhaihole@gmail.com';
  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: 'Sanjay A',
      role: 'SUPER_ADMIN',
      isActive: true,
      isVerified: true,
    },
    update: { role: 'SUPER_ADMIN', isActive: true },
  });
  console.log(`✅ Admin created: ${admin.email} (${admin.role})`);

  // ── Email Templates ──────────────────────────────────
  const regTemplate = await prisma.emailTemplate.upsert({
    where: { id: 'seed-reg-template' },
    create: {
      id: 'seed-reg-template',
      name: 'Registration Confirmation',
      type: 'REGISTRATION_CONFIRMATION',
      subject: '✅ Registration Confirmed — {{event_name}}',
      htmlBody: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #06b6d4; font-size: 28px; margin: 0;">🎉 Registration Confirmed!</h1>
          </div>
          <p style="font-size: 16px; line-height: 1.6;">Hi <strong>{{participant_name}}</strong>,</p>
          <p style="font-size: 16px; line-height: 1.6;">Your registration for <strong>{{event_name}}</strong> has been successfully recorded.</p>
          <div style="background: #1e293b; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #06b6d4;">
            <p style="margin: 8px 0;"><strong>Registration ID:</strong> {{registration_id}}</p>
            <p style="margin: 8px 0;"><strong>Team:</strong> {{team_name}}</p>
            <p style="margin: 8px 0;"><strong>Email:</strong> {{email}}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> {{registration_date}}</p>
          </div>
          <p style="font-size: 14px; color: #94a3b8;">Please keep your Registration ID safe. You'll need it for future reference.</p>
          <hr style="border: none; border-top: 1px solid #334155; margin: 32px 0;" />
          <p style="font-size: 12px; color: #64748b; text-align: center;">Next Gen Buildathon — Building the Future Together</p>
        </div>
      `,
      textBody: 'Hi {{participant_name}},\n\nYour registration for {{event_name}} is confirmed.\n\nRegistration ID: {{registration_id}}\nTeam: {{team_name}}\nEmail: {{email}}\nDate: {{registration_date}}\n\nNext Gen Buildathon',
      senderName: 'Next Gen Buildathon',
      isActive: true,
      variables: ['participant_name', 'event_name', 'registration_id', 'team_name', 'email', 'registration_date'],
    },
    update: {},
  });
  console.log(`✅ Registration email template created`);

  const shortlistTemplate = await prisma.emailTemplate.upsert({
    where: { id: 'seed-shortlist-template' },
    create: {
      id: 'seed-shortlist-template',
      name: 'Shortlist Notification',
      type: 'SHORTLIST_NOTIFICATION',
      subject: '🏆 Congratulations! You\'re Shortlisted — {{event_name}}',
      htmlBody: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #10b981; font-size: 28px; margin: 0;">🏆 You've Been Shortlisted!</h1>
          </div>
          <p style="font-size: 16px; line-height: 1.6;">Dear <strong>{{participant_name}}</strong>,</p>
          <p style="font-size: 16px; line-height: 1.6;">Congratulations! Your team <strong>{{team_name}}</strong> has been <span style="color: #10b981; font-weight: bold;">SHORTLISTED</span> for <strong>{{event_name}}</strong>!</p>
          <div style="background: #1e293b; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #10b981;">
            <p style="margin: 8px 0;"><strong>Registration ID:</strong> {{registration_id}}</p>
            <p style="margin: 8px 0;"><strong>Status:</strong> SHORTLISTED ✅</p>
          </div>
          <p style="font-size: 16px; line-height: 1.6;">Further details about the next round will be shared soon. Stay tuned!</p>
          <hr style="border: none; border-top: 1px solid #334155; margin: 32px 0;" />
          <p style="font-size: 12px; color: #64748b; text-align: center;">Next Gen Buildathon — Building the Future Together</p>
        </div>
      `,
      textBody: 'Dear {{participant_name}},\n\nCongratulations! Team {{team_name}} has been SHORTLISTED for {{event_name}}!\n\nRegistration ID: {{registration_id}}\n\nFurther details coming soon.\n\nNext Gen Buildathon',
      senderName: 'Next Gen Buildathon',
      isActive: true,
      variables: ['participant_name', 'event_name', 'registration_id', 'team_name', 'status'],
    },
    update: {},
  });
  console.log(`✅ Shortlist email template created`);

  // ── Forms ─────────────────────────────────────────
  const form1 = await prisma.form.upsert({
    where: { id: 'seed-form-ai' },
    create: {
      id: 'seed-form-ai',
      title: 'AI Innovation Buildathon Registration',
      description: 'Register your team for the AI Innovation Buildathon 2026',
      status: 'PUBLISHED',
    },
    update: {},
  });

  const formVersion1 = await prisma.formVersion.upsert({
    where: { id: 'seed-form-ai-v1' },
    create: {
      id: 'seed-form-ai-v1',
      formId: form1.id,
      version: 1,
      publishedAt: new Date(),
    },
    update: {},
  });

  await prisma.form.update({
    where: { id: form1.id },
    data: { currentVersionId: formVersion1.id },
  });

  // Create form fields
  const aiFields = [
    { type: 'SHORT_TEXT', label: 'Team Name', name: 'team_name', required: true, order: 0, placeholder: 'Enter your team name' },
    { type: 'SHORT_TEXT', label: 'Team Leader Name', name: 'team_leader_name', required: true, order: 1, placeholder: 'Full name of team leader' },
    { type: 'EMAIL', label: 'Team Leader Email', name: 'email', required: true, order: 2, placeholder: 'team@example.com' },
    { type: 'PHONE', label: 'Phone Number', name: 'phone', required: true, order: 3, placeholder: '+91 XXXXX XXXXX' },
    { type: 'SHORT_TEXT', label: 'College/University', name: 'college_name', required: true, order: 4, placeholder: 'Your institution' },
    { type: 'SHORT_TEXT', label: 'City', name: 'city', required: false, order: 5, placeholder: 'Your city' },
    { type: 'DROPDOWN', label: 'Team Size', name: 'team_size', required: true, order: 6, options: ['1', '2', '3', '4', '5'] },
    { type: 'RADIO', label: 'Problem Statement Track', name: 'problem_statement', required: true, order: 7, options: ['Natural Language Processing', 'Computer Vision', 'Generative AI', 'MLOps & Deployment', 'Open Innovation'] },
    { type: 'LONG_TEXT', label: 'Project Idea (Brief Description)', name: 'project_idea', required: true, order: 8, placeholder: 'Describe your project idea in 200-500 words', validation: { minLength: 50, maxLength: 2000 } },
    { type: 'URL', label: 'GitHub / Portfolio Link', name: 'github_link', required: false, order: 9, placeholder: 'https://github.com/...' },
    { type: 'CHECKBOX', label: 'I agree to the Terms and Conditions', name: 'terms_accepted', required: true, order: 10 },
  ];

  for (const field of aiFields) {
    await prisma.formField.upsert({
      where: { id: `seed-field-ai-${field.name}` },
      create: {
        id: `seed-field-ai-${field.name}`,
        formVersionId: formVersion1.id,
        ...field,
        options: field.options || null,
        validation: (field as any).validation || null,
      },
      update: {},
    });
  }
  console.log(`✅ AI Buildathon form created with ${aiFields.length} fields`);

  // ── Domains ──────────────────────────────────────
  const domain1 = await prisma.domain.upsert({
    where: { slug: 'ai-innovation-buildathon-2026' },
    create: {
      name: 'AI Innovation Buildathon 2026',
      slug: 'ai-innovation-buildathon-2026',
      description: 'Push the boundaries of artificial intelligence. Build innovative AI solutions that solve real-world problems.',
      eventDate: new Date('2026-11-15'),
      registrationStart: new Date('2026-09-01'),
      registrationEnd: new Date('2026-10-31'),
      maxRegistrations: 500,
      status: 'ACTIVE',
      formId: form1.id,
      registrationEmailTemplateId: regTemplate.id,
      shortlistEmailTemplateId: shortlistTemplate.id,
      worksheetName: 'AI Buildathon Registrations',
    },
    update: {},
  });
  console.log(`✅ Domain created: ${domain1.name}`);

  const domain2 = await prisma.domain.upsert({
    where: { slug: 'web-dev-challenge-2026' },
    create: {
      name: 'Web Development Challenge 2026',
      slug: 'web-dev-challenge-2026',
      description: 'Design and develop stunning web applications. Showcase your frontend and full-stack development skills.',
      eventDate: new Date('2026-12-01'),
      registrationStart: new Date('2026-09-15'),
      registrationEnd: new Date('2026-11-15'),
      maxRegistrations: 300,
      status: 'ACTIVE',
      registrationEmailTemplateId: regTemplate.id,
      shortlistEmailTemplateId: shortlistTemplate.id,
      worksheetName: 'Web Dev Challenge Registrations',
    },
    update: {},
  });
  console.log(`✅ Domain created: ${domain2.name}`);

  // ── Sample Registrations ──────────────────────────
  const sampleTeams = [
    { teamName: 'Neural Navigators', leader: 'Aisha Patel', email: 'aisha@example.com', phone: '+91 98765 43210', college: 'IIT Bombay', city: 'Mumbai', size: '4', track: 'Natural Language Processing' },
    { teamName: 'Deep Think', leader: 'Rahul Kumar', email: 'rahul@example.com', phone: '+91 87654 32109', college: 'IIT Delhi', city: 'Delhi', size: '3', track: 'Computer Vision' },
    { teamName: 'Code Crushers', leader: 'Priya Sharma', email: 'priya@example.com', phone: '+91 76543 21098', college: 'BITS Pilani', city: 'Pilani', size: '5', track: 'Generative AI' },
    { teamName: 'AI Pioneers', leader: 'Vikram Singh', email: 'vikram@example.com', phone: '+91 65432 10987', college: 'IIT Madras', city: 'Chennai', size: '4', track: 'MLOps & Deployment' },
    { teamName: 'ByteForce', leader: 'Sneha Reddy', email: 'sneha@example.com', phone: '+91 54321 09876', college: 'IIIT Hyderabad', city: 'Hyderabad', size: '3', track: 'Open Innovation' },
    { teamName: 'Quantum Coders', leader: 'Arjun Menon', email: 'arjun@example.com', phone: '+91 43210 98765', college: 'NIT Trichy', city: 'Trichy', size: '4', track: 'Natural Language Processing' },
    { teamName: 'TechTitans', leader: 'Divya Joshi', email: 'divya@example.com', phone: '+91 32109 87654', college: 'VIT Vellore', city: 'Vellore', size: '5', track: 'Computer Vision' },
    { teamName: 'InnoVerse', leader: 'Karthik Nair', email: 'karthik@example.com', phone: '+91 21098 76543', college: 'IIIT Bangalore', city: 'Bangalore', size: '3', track: 'Generative AI' },
  ];

  const statuses = ['REGISTERED', 'REGISTERED', 'SHORTLISTED', 'REGISTERED', 'UNDER_REVIEW', 'REGISTERED', 'REJECTED', 'SHORTLISTED'];

  for (let i = 0; i < sampleTeams.length; i++) {
    const team = sampleTeams[i];
    const regId = `NGB-260916-${String(i + 1).padStart(5, '0')}`;

    await prisma.registration.upsert({
      where: { registrationId: regId },
      create: {
        registrationId: regId,
        domainId: domain1.id,
        formVersionId: formVersion1.id,
        teamName: team.teamName,
        teamLeaderName: team.leader,
        email: team.email,
        phone: team.phone,
        status: statuses[i],
        syncStatus: 'SYNCED',
        values: {
          team_name: team.teamName,
          team_leader_name: team.leader,
          email: team.email,
          phone: team.phone,
          college_name: team.college,
          city: team.city,
          team_size: team.size,
          problem_statement: team.track,
          project_idea: `An innovative AI solution focused on ${team.track} that aims to revolutionize how we approach complex challenges in this domain.`,
          github_link: `https://github.com/${team.leader.toLowerCase().replace(/\s/g, '')}`,
          terms_accepted: true,
        },
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      },
      update: {},
    });
  }

  // Update domain registration count
  await prisma.domain.update({
    where: { id: domain1.id },
    data: {
      registrationCount: sampleTeams.length,
      shortlistedCount: statuses.filter(s => s === 'SHORTLISTED').length,
    },
  });

  console.log(`✅ ${sampleTeams.length} sample registrations created`);

  // ── System Settings ─────────────────────────────
  const defaultSettings: Record<string, unknown> = {
    organizationName: 'Next Gen Buildathon',
    defaultSenderName: 'Next Gen Buildathon',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    captchaEnabled: true,
    captchaScoreThreshold: 0.5,
    maxFileSize: 10,
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: value as object },
      update: {},
    });
  }
  console.log(`✅ System settings configured`);

  console.log('\n🎉 Seed complete! The platform is ready for testing.');
  console.log(`\n📌 Admin email: ${adminEmail}`);
  console.log(`📌 Sample domain: /register/ai-innovation-buildathon-2026`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
