/**
 * Database Seed Script
 * Run: pnpm db:seed
 * 
 * Creates demo data for development/testing.
 * This is OPTIONAL - production instances start with empty tables.
 * 
 * IMPORTANT: This script is IDEMPOTENT - safe to run multiple times.
 * It will NOT delete existing data, only insert demo data if it doesn't exist.
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { eq, count } from "drizzle-orm"
import { persons } from "../lib/db/schema/people"
import { organizationalLevels } from "../lib/db/schema/org-levels"
import { securityStandardControls } from "../lib/db/schema/security"

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/idaraos"

async function seed() {
  console.log("🌱 Starting database seed...")
  
  const pool = new Pool({ connectionString: DATABASE_URL })
  const db = drizzle(pool)
  
  // Demo organization ID - in production, this comes from auth
  const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"
  
  // Demo users with generic data
  const demoUsers = [
    {
      orgId: DEMO_ORG_ID,
      slug: "john-doe",
      name: "John Doe",
      email: "john@example.com",
      role: "CEO",
      team: "Executive",
      status: "active" as const,
      startDate: "2020-01-15",
      location: "New York",
    },
    {
      orgId: DEMO_ORG_ID,
      slug: "jane-smith",
      name: "Jane Smith",
      email: "jane@example.com",
      role: "CTO",
      team: "Engineering",
      status: "active" as const,
      startDate: "2020-02-01",
      location: "San Francisco",
    },
    {
      orgId: DEMO_ORG_ID,
      slug: "bob-wilson",
      name: "Bob Wilson",
      email: "bob@example.com",
      role: "Security Lead",
      team: "Security",
      status: "active" as const,
      startDate: "2021-03-10",
      location: "Austin",
    },
    {
      orgId: DEMO_ORG_ID,
      slug: "alice-johnson",
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "HR Manager",
      team: "People",
      status: "active" as const,
      startDate: "2021-06-15",
      location: "Chicago",
    },
    {
      orgId: DEMO_ORG_ID,
      slug: "new-employee",
      name: "New Employee",
      email: "new@example.com",
      role: "Software Engineer",
      team: "Engineering",
      status: "onboarding" as const,
      startDate: "2024-11-01",
      location: "Remote",
    },
  ]
  
  try {
    // Check if demo data already exists - use john@example.com as sentinel
    console.log("  Checking for existing seed data...")
    const existingDemo = await db
      .select({ id: persons.id })
      .from(persons)
      .where(eq(persons.email, "john@example.com"))
      .limit(1)
    
    const skipUsers = existingDemo.length > 0
    if (skipUsers) {
      console.log("✅ Demo users already exist. Skipping user creation.")
    }
    
    // Insert demo users (only if they don't exist)
    if (!skipUsers) {
      console.log("  Inserting demo users...")
      let insertedCount = 0
      
      for (const user of demoUsers) {
        // Check if this specific user already exists
        const exists = await db
          .select({ id: persons.id })
          .from(persons)
          .where(eq(persons.email, user.email))
          .limit(1)
        
        if (exists.length === 0) {
          await db.insert(persons).values(user)
          insertedCount++
        }
      }
      
      console.log(`✅ Users seed complete! Created ${insertedCount} demo users.`)
      if (insertedCount > 0) {
        console.log("\n  Demo users created:")
        console.log("  - john@example.com (CEO)")
        console.log("  - jane@example.com (CTO)")
        console.log("  - bob@example.com (Security Lead)")
        console.log("  - alice@example.com (HR Manager)")
        console.log("  - new@example.com (New Employee)")
      }
    }
    
    // Seed organizational levels
    console.log("\n  Checking for existing organizational levels...")
    const existingLevels = await db
      .select({ id: organizationalLevels.id })
      .from(organizationalLevels)
      .where(eq(organizationalLevels.orgId, DEMO_ORG_ID))
      .limit(1)
    
    if (existingLevels.length > 0) {
      console.log("✅ Organizational levels already exist. Skipping.")
    } else {
      console.log("  Inserting default organizational levels...")
      
      const defaultLevels = [
        {
          orgId: DEMO_ORG_ID,
          code: "L0",
          name: "Executive",
          description: "C-suite and executive leadership",
          sortOrder: 0,
        },
        {
          orgId: DEMO_ORG_ID,
          code: "L1",
          name: "Director",
          description: "Department and division heads",
          sortOrder: 1,
        },
        {
          orgId: DEMO_ORG_ID,
          code: "L2",
          name: "Manager",
          description: "Team managers and supervisors",
          sortOrder: 2,
        },
        {
          orgId: DEMO_ORG_ID,
          code: "L3",
          name: "Senior",
          description: "Senior individual contributors",
          sortOrder: 3,
        },
        {
          orgId: DEMO_ORG_ID,
          code: "L4",
          name: "Staff",
          description: "Standard individual contributors",
          sortOrder: 4,
        },
        {
          orgId: DEMO_ORG_ID,
          code: "L5",
          name: "Entry",
          description: "Entry-level positions",
          sortOrder: 5,
        },
      ]
      
      await db.insert(organizationalLevels).values(defaultLevels)
      
      console.log("✅ Organizational levels created:")
      for (const level of defaultLevels) {
        console.log(`  - ${level.code}: ${level.name}`)
      }
    }
    
    // Seed security standard controls (ISO 27001 + SOC 2)
    console.log("\n  Checking for existing security standard controls...")
    const [{ controlCount }] = await db
      .select({ controlCount: count() })
      .from(securityStandardControls)
    
    if (controlCount > 0) {
      console.log(`✅ Security standard controls already exist (${controlCount} controls). Skipping.`)
    } else {
      console.log("  Inserting security standard controls...")
      
      // ISO 27001:2022 Annex A Controls (93 controls)
      const iso27001Controls = [
        // A.5 - Organizational Controls (37 controls)
        { controlId: "A.5.1", category: "Organizational", subcategory: "Policies for information security", title: "Policies for information security", description: "Information security policy and topic-specific policies shall be defined, approved by management, published, communicated to and acknowledged by relevant personnel and relevant interested parties, and reviewed at planned intervals and if significant changes occur." },
        { controlId: "A.5.2", category: "Organizational", subcategory: "Policies for information security", title: "Information security roles and responsibilities", description: "Information security roles and responsibilities shall be defined and allocated according to the organization needs." },
        { controlId: "A.5.3", category: "Organizational", subcategory: "Policies for information security", title: "Segregation of duties", description: "Conflicting duties and conflicting areas of responsibility shall be segregated." },
        { controlId: "A.5.4", category: "Organizational", subcategory: "Policies for information security", title: "Management responsibilities", description: "Management shall require all personnel to apply information security in accordance with the established information security policy, topic-specific policies and procedures of the organization." },
        { controlId: "A.5.5", category: "Organizational", subcategory: "Policies for information security", title: "Contact with authorities", description: "The organization shall establish and maintain contact with relevant authorities." },
        { controlId: "A.5.6", category: "Organizational", subcategory: "Policies for information security", title: "Contact with special interest groups", description: "The organization shall establish and maintain contact with special interest groups or other specialist security forums and professional associations." },
        { controlId: "A.5.7", category: "Organizational", subcategory: "Threat intelligence", title: "Threat intelligence", description: "Information relating to information security threats shall be collected and analysed to produce threat intelligence." },
        { controlId: "A.5.8", category: "Organizational", subcategory: "Information security in project management", title: "Information security in project management", description: "Information security shall be integrated into project management." },
        { controlId: "A.5.9", category: "Organizational", subcategory: "Inventory of information and other associated assets", title: "Inventory of information and other associated assets", description: "An inventory of information and other associated assets, including owners, shall be developed and maintained." },
        { controlId: "A.5.10", category: "Organizational", subcategory: "Inventory of information and other associated assets", title: "Acceptable use of information and other associated assets", description: "Rules for the acceptable use and procedures for handling information and other associated assets shall be identified, documented and implemented." },
        { controlId: "A.5.11", category: "Organizational", subcategory: "Inventory of information and other associated assets", title: "Return of assets", description: "Personnel and other interested parties as appropriate shall return all the organization's assets in their possession upon change or termination of their employment, contract or agreement." },
        { controlId: "A.5.12", category: "Organizational", subcategory: "Classification of information", title: "Classification of information", description: "Information shall be classified according to the information security needs of the organization based on confidentiality, integrity, availability and relevant interested party requirements." },
        { controlId: "A.5.13", category: "Organizational", subcategory: "Classification of information", title: "Labelling of information", description: "An appropriate set of procedures for information labelling shall be developed and implemented in accordance with the information classification scheme adopted by the organization." },
        { controlId: "A.5.14", category: "Organizational", subcategory: "Information transfer", title: "Information transfer", description: "Information transfer rules, procedures, or agreements shall be in place for all types of transfer facilities within the organization and between the organization and other parties." },
        { controlId: "A.5.15", category: "Organizational", subcategory: "Access control", title: "Access control", description: "Rules to control physical and logical access to information and other associated assets shall be established and implemented based on business and information security requirements." },
        { controlId: "A.5.16", category: "Organizational", subcategory: "Identity management", title: "Identity management", description: "The full life cycle of identities shall be managed." },
        { controlId: "A.5.17", category: "Organizational", subcategory: "Identity management", title: "Authentication information", description: "Allocation and management of authentication information shall be controlled by a management process, including advising personnel on appropriate handling of authentication information." },
        { controlId: "A.5.18", category: "Organizational", subcategory: "Access rights", title: "Access rights", description: "Access rights to information and other associated assets shall be provisioned, reviewed, modified and removed in accordance with the organization's topic-specific policy on and rules for access control." },
        { controlId: "A.5.19", category: "Organizational", subcategory: "Information security in supplier relationships", title: "Information security in supplier relationships", description: "Processes and procedures shall be defined and implemented to manage the information security risks associated with the use of supplier's products or services." },
        { controlId: "A.5.20", category: "Organizational", subcategory: "Information security in supplier relationships", title: "Addressing information security within supplier agreements", description: "Relevant information security requirements shall be established and agreed with each supplier based on the type of supplier relationship." },
        { controlId: "A.5.21", category: "Organizational", subcategory: "Information security in supplier relationships", title: "Managing information security in the ICT supply chain", description: "Processes and procedures shall be defined and implemented to manage the information security risks associated with the ICT products and services supply chain." },
        { controlId: "A.5.22", category: "Organizational", subcategory: "Information security in supplier relationships", title: "Monitoring, review and change management of supplier services", description: "The organization shall regularly monitor, review, evaluate and manage change in supplier information security practices and service delivery." },
        { controlId: "A.5.23", category: "Organizational", subcategory: "Information security for use of cloud services", title: "Information security for use of cloud services", description: "Processes for acquisition, use, management and exit from cloud services shall be established in accordance with the organization's information security requirements." },
        { controlId: "A.5.24", category: "Organizational", subcategory: "Information security incident management", title: "Information security incident management planning and preparation", description: "The organization shall plan and prepare for managing information security incidents by defining, establishing and communicating information security incident management processes, roles and responsibilities." },
        { controlId: "A.5.25", category: "Organizational", subcategory: "Information security incident management", title: "Assessment and decision on information security events", description: "The organization shall assess information security events and decide if they are to be categorized as information security incidents." },
        { controlId: "A.5.26", category: "Organizational", subcategory: "Information security incident management", title: "Response to information security incidents", description: "Information security incidents shall be responded to in accordance with the documented procedures." },
        { controlId: "A.5.27", category: "Organizational", subcategory: "Information security incident management", title: "Learning from information security incidents", description: "Knowledge gained from information security incidents shall be used to strengthen and improve the information security controls." },
        { controlId: "A.5.28", category: "Organizational", subcategory: "Information security incident management", title: "Collection of evidence", description: "The organization shall establish and implement procedures for the identification, collection, acquisition and preservation of evidence related to information security events." },
        { controlId: "A.5.29", category: "Organizational", subcategory: "Business continuity", title: "Information security during disruption", description: "The organization shall plan how to maintain information security at an appropriate level during disruption." },
        { controlId: "A.5.30", category: "Organizational", subcategory: "Business continuity", title: "ICT readiness for business continuity", description: "ICT readiness shall be planned, implemented, maintained and tested based on business continuity objectives and ICT continuity requirements." },
        { controlId: "A.5.31", category: "Organizational", subcategory: "Compliance", title: "Legal, statutory, regulatory and contractual requirements", description: "Legal, statutory, regulatory and contractual requirements relevant to information security and the organization's approach to meet these requirements shall be identified, documented and kept up to date." },
        { controlId: "A.5.32", category: "Organizational", subcategory: "Compliance", title: "Intellectual property rights", description: "The organization shall implement appropriate procedures to protect intellectual property rights." },
        { controlId: "A.5.33", category: "Organizational", subcategory: "Compliance", title: "Protection of records", description: "Records shall be protected from loss, destruction, falsification, unauthorized access and unauthorized release." },
        { controlId: "A.5.34", category: "Organizational", subcategory: "Compliance", title: "Privacy and protection of PII", description: "The organization shall identify and meet the requirements regarding the preservation of privacy and protection of PII according to applicable laws and regulations and contractual requirements." },
        { controlId: "A.5.35", category: "Organizational", subcategory: "Compliance", title: "Independent review of information security", description: "The organization's approach to managing information security and its implementation including people, processes and technologies shall be reviewed independently at planned intervals, or when significant changes occur." },
        { controlId: "A.5.36", category: "Organizational", subcategory: "Compliance", title: "Compliance with policies, rules and standards for information security", description: "Compliance with the organization's information security policy, topic-specific policies, rules and standards shall be regularly reviewed." },
        { controlId: "A.5.37", category: "Organizational", subcategory: "Compliance", title: "Documented operating procedures", description: "Operating procedures for information processing facilities shall be documented and made available to personnel who need them." },
        // A.6 - People Controls (8 controls)
        { controlId: "A.6.1", category: "People", subcategory: "Screening", title: "Screening", description: "Background verification checks on all candidates to become personnel shall be carried out prior to joining the organization and on an ongoing basis." },
        { controlId: "A.6.2", category: "People", subcategory: "Terms and conditions of employment", title: "Terms and conditions of employment", description: "The employment contractual agreements shall state the personnel's and the organization's responsibilities for information security." },
        { controlId: "A.6.3", category: "People", subcategory: "Information security awareness, education and training", title: "Information security awareness, education and training", description: "Personnel of the organization and relevant interested parties shall receive appropriate information security awareness, education and training and regular updates." },
        { controlId: "A.6.4", category: "People", subcategory: "Disciplinary process", title: "Disciplinary process", description: "A disciplinary process shall be formalized and communicated to take actions against personnel and other relevant interested parties who have committed an information security policy violation." },
        { controlId: "A.6.5", category: "People", subcategory: "Responsibilities after termination or change of employment", title: "Responsibilities after termination or change of employment", description: "Information security responsibilities and duties that remain valid after termination or change of employment shall be defined, enforced and communicated to relevant personnel and other interested parties." },
        { controlId: "A.6.6", category: "People", subcategory: "Confidentiality or non-disclosure agreements", title: "Confidentiality or non-disclosure agreements", description: "Confidentiality or non-disclosure agreements reflecting the organization's needs for the protection of information shall be identified, documented, regularly reviewed and signed by personnel and other relevant interested parties." },
        { controlId: "A.6.7", category: "People", subcategory: "Remote working", title: "Remote working", description: "Security measures shall be implemented when personnel are working remotely to protect information accessed, processed or stored outside the organization's premises." },
        { controlId: "A.6.8", category: "People", subcategory: "Information security event reporting", title: "Information security event reporting", description: "The organization shall provide a mechanism for personnel to report observed or suspected information security events through appropriate channels in a timely manner." },
        // A.7 - Physical Controls (14 controls)
        { controlId: "A.7.1", category: "Physical", subcategory: "Physical security perimeters", title: "Physical security perimeters", description: "Security perimeters shall be defined and used to protect areas that contain information and other associated assets." },
        { controlId: "A.7.2", category: "Physical", subcategory: "Physical entry", title: "Physical entry", description: "Secure areas shall be protected by appropriate entry controls and access points." },
        { controlId: "A.7.3", category: "Physical", subcategory: "Securing offices, rooms and facilities", title: "Securing offices, rooms and facilities", description: "Physical security for offices, rooms and facilities shall be designed and implemented." },
        { controlId: "A.7.4", category: "Physical", subcategory: "Physical security monitoring", title: "Physical security monitoring", description: "Premises shall be continuously monitored for unauthorized physical access." },
        { controlId: "A.7.5", category: "Physical", subcategory: "Protecting against physical and environmental threats", title: "Protecting against physical and environmental threats", description: "Protection against physical and environmental threats, such as natural disasters and other intentional or unintentional physical threats to infrastructure shall be designed and implemented." },
        { controlId: "A.7.6", category: "Physical", subcategory: "Working in secure areas", title: "Working in secure areas", description: "Security measures for working in secure areas shall be designed and implemented." },
        { controlId: "A.7.7", category: "Physical", subcategory: "Clear desk and clear screen", title: "Clear desk and clear screen", description: "Clear desk rules for papers and removable storage media and clear screen rules for information processing facilities shall be defined and appropriately enforced." },
        { controlId: "A.7.8", category: "Physical", subcategory: "Equipment siting and protection", title: "Equipment siting and protection", description: "Equipment shall be sited securely and protected." },
        { controlId: "A.7.9", category: "Physical", subcategory: "Security of assets off-premises", title: "Security of assets off-premises", description: "Off-site assets shall be protected." },
        { controlId: "A.7.10", category: "Physical", subcategory: "Storage media", title: "Storage media", description: "Storage media shall be managed through their life cycle of acquisition, use, transportation and disposal in accordance with the organization's classification scheme and handling requirements." },
        { controlId: "A.7.11", category: "Physical", subcategory: "Supporting utilities", title: "Supporting utilities", description: "Information processing facilities shall be protected from power failures and other disruptions caused by failures in supporting utilities." },
        { controlId: "A.7.12", category: "Physical", subcategory: "Cabling security", title: "Cabling security", description: "Cables carrying power, data or supporting information services shall be protected from interception, interference or damage." },
        { controlId: "A.7.13", category: "Physical", subcategory: "Equipment maintenance", title: "Equipment maintenance", description: "Equipment shall be maintained correctly to ensure availability, integrity and confidentiality of information." },
        { controlId: "A.7.14", category: "Physical", subcategory: "Secure disposal or re-use of equipment", title: "Secure disposal or re-use of equipment", description: "Items of equipment containing storage media shall be verified to ensure that any sensitive data and licensed software has been removed or securely overwritten prior to disposal or re-use." },
        // A.8 - Technological Controls (34 controls)
        { controlId: "A.8.1", category: "Technological", subcategory: "User endpoint devices", title: "User endpoint devices", description: "Information stored on, processed by or accessible via user endpoint devices shall be protected." },
        { controlId: "A.8.2", category: "Technological", subcategory: "Privileged access rights", title: "Privileged access rights", description: "The allocation and use of privileged access rights shall be restricted and managed." },
        { controlId: "A.8.3", category: "Technological", subcategory: "Information access restriction", title: "Information access restriction", description: "Access to information and other associated assets shall be restricted in accordance with the established topic-specific policy on access control." },
        { controlId: "A.8.4", category: "Technological", subcategory: "Access to source code", title: "Access to source code", description: "Read and write access to source code, development tools and software libraries shall be appropriately managed." },
        { controlId: "A.8.5", category: "Technological", subcategory: "Secure authentication", title: "Secure authentication", description: "Secure authentication technologies and procedures shall be implemented based on information access restrictions and the topic-specific policy on access control." },
        { controlId: "A.8.6", category: "Technological", subcategory: "Capacity management", title: "Capacity management", description: "The use of resources shall be monitored and adjusted in line with current and expected capacity requirements." },
        { controlId: "A.8.7", category: "Technological", subcategory: "Protection against malware", title: "Protection against malware", description: "Protection against malware shall be implemented and supported by appropriate user awareness." },
        { controlId: "A.8.8", category: "Technological", subcategory: "Management of technical vulnerabilities", title: "Management of technical vulnerabilities", description: "Information about technical vulnerabilities of information systems in use shall be obtained, the organization's exposure to such vulnerabilities shall be evaluated and appropriate measures shall be taken." },
        { controlId: "A.8.9", category: "Technological", subcategory: "Configuration management", title: "Configuration management", description: "Configurations, including security configurations, of hardware, software, services and networks shall be established, documented, implemented, monitored and reviewed." },
        { controlId: "A.8.10", category: "Technological", subcategory: "Information deletion", title: "Information deletion", description: "Information stored in information systems, devices or in any other storage media shall be deleted when no longer required." },
        { controlId: "A.8.11", category: "Technological", subcategory: "Data masking", title: "Data masking", description: "Data masking shall be used in accordance with the organization's topic-specific policy on access control and other related topic-specific policies, and business requirements, taking applicable legislation into consideration." },
        { controlId: "A.8.12", category: "Technological", subcategory: "Data leakage prevention", title: "Data leakage prevention", description: "Data leakage prevention measures shall be applied to systems, networks and any other devices that process, store or transmit sensitive information." },
        { controlId: "A.8.13", category: "Technological", subcategory: "Information backup", title: "Information backup", description: "Backup copies of information, software and systems shall be maintained and regularly tested in accordance with the agreed topic-specific policy on backup." },
        { controlId: "A.8.14", category: "Technological", subcategory: "Redundancy of information processing facilities", title: "Redundancy of information processing facilities", description: "Information processing facilities shall be implemented with redundancy sufficient to meet availability requirements." },
        { controlId: "A.8.15", category: "Technological", subcategory: "Logging", title: "Logging", description: "Logs that record activities, exceptions, faults and other relevant events shall be produced, stored, protected and analysed." },
        { controlId: "A.8.16", category: "Technological", subcategory: "Monitoring activities", title: "Monitoring activities", description: "Networks, systems and applications shall be monitored for anomalous behaviour and appropriate actions taken to evaluate potential information security incidents." },
        { controlId: "A.8.17", category: "Technological", subcategory: "Clock synchronization", title: "Clock synchronization", description: "The clocks of information processing systems used by the organization shall be synchronized to approved time sources." },
        { controlId: "A.8.18", category: "Technological", subcategory: "Use of privileged utility programs", title: "Use of privileged utility programs", description: "The use of utility programs that can be capable of overriding system and application controls shall be restricted and tightly controlled." },
        { controlId: "A.8.19", category: "Technological", subcategory: "Installation of software on operational systems", title: "Installation of software on operational systems", description: "Procedures and measures shall be implemented to securely manage software installation on operational systems." },
        { controlId: "A.8.20", category: "Technological", subcategory: "Networks security", title: "Networks security", description: "Networks and network devices shall be secured, managed and controlled to protect information in systems and applications." },
        { controlId: "A.8.21", category: "Technological", subcategory: "Security of network services", title: "Security of network services", description: "Security mechanisms, service levels and service requirements of network services shall be identified, implemented and monitored." },
        { controlId: "A.8.22", category: "Technological", subcategory: "Segregation of networks", title: "Segregation of networks", description: "Groups of information services, users and information systems shall be segregated in the organization's networks." },
        { controlId: "A.8.23", category: "Technological", subcategory: "Web filtering", title: "Web filtering", description: "Access to external websites shall be managed to reduce exposure to malicious content." },
        { controlId: "A.8.24", category: "Technological", subcategory: "Use of cryptography", title: "Use of cryptography", description: "Rules for the effective use of cryptography, including cryptographic key management, shall be defined and implemented." },
        { controlId: "A.8.25", category: "Technological", subcategory: "Secure development life cycle", title: "Secure development life cycle", description: "Rules for the secure development of software and systems shall be established and applied." },
        { controlId: "A.8.26", category: "Technological", subcategory: "Application security requirements", title: "Application security requirements", description: "Information security requirements shall be identified, specified and approved when developing or acquiring applications." },
        { controlId: "A.8.27", category: "Technological", subcategory: "Secure system architecture and engineering principles", title: "Secure system architecture and engineering principles", description: "Principles for engineering secure systems shall be established, documented, maintained and applied to any information system development activities." },
        { controlId: "A.8.28", category: "Technological", subcategory: "Secure coding", title: "Secure coding", description: "Secure coding principles shall be applied to software development." },
        { controlId: "A.8.29", category: "Technological", subcategory: "Security testing in development and acceptance", title: "Security testing in development and acceptance", description: "Security testing processes shall be defined and implemented in the development life cycle." },
        { controlId: "A.8.30", category: "Technological", subcategory: "Outsourced development", title: "Outsourced development", description: "The organization shall direct, monitor and review the activities related to outsourced system development." },
        { controlId: "A.8.31", category: "Technological", subcategory: "Separation of development, test and production environments", title: "Separation of development, test and production environments", description: "Development, testing and production environments shall be separated and secured." },
        { controlId: "A.8.32", category: "Technological", subcategory: "Change management", title: "Change management", description: "Changes to information processing facilities and information systems shall be subject to change management procedures." },
        { controlId: "A.8.33", category: "Technological", subcategory: "Test information", title: "Test information", description: "Test information shall be appropriately selected, protected and managed." },
        { controlId: "A.8.34", category: "Technological", subcategory: "Protection of information systems during audit testing", title: "Protection of information systems during audit testing", description: "Audit tests and other assurance activities involving assessment of operational systems shall be planned and agreed between the tester and appropriate management." },
      ]
      
      // SOC 2 Trust Service Criteria
      const soc2Controls = [
        // CC1 - Control Environment
        { controlId: "CC1.1", category: "Security - Control Environment", subcategory: "COSO Principle 1", title: "Demonstrates commitment to integrity and ethical values", description: "The entity demonstrates a commitment to integrity and ethical values." },
        { controlId: "CC1.2", category: "Security - Control Environment", subcategory: "COSO Principle 2", title: "Exercises oversight responsibility", description: "The board of directors demonstrates independence from management and exercises oversight of the development and performance of internal control." },
        { controlId: "CC1.3", category: "Security - Control Environment", subcategory: "COSO Principle 3", title: "Establishes structure, authority, and responsibility", description: "Management establishes, with board oversight, structures, reporting lines, and appropriate authorities and responsibilities in the pursuit of objectives." },
        { controlId: "CC1.4", category: "Security - Control Environment", subcategory: "COSO Principle 4", title: "Demonstrates commitment to competence", description: "The entity demonstrates a commitment to attract, develop, and retain competent individuals in alignment with objectives." },
        { controlId: "CC1.5", category: "Security - Control Environment", subcategory: "COSO Principle 5", title: "Enforces accountability", description: "The entity holds individuals accountable for their internal control responsibilities in the pursuit of objectives." },
        // CC2 - Communication and Information
        { controlId: "CC2.1", category: "Security - Communication and Information", subcategory: "COSO Principle 13", title: "Obtains or generates relevant, quality information", description: "The entity obtains or generates and uses relevant, quality information to support the functioning of internal control." },
        { controlId: "CC2.2", category: "Security - Communication and Information", subcategory: "COSO Principle 14", title: "Communicates internally", description: "The entity internally communicates information, including objectives and responsibilities for internal control, necessary to support the functioning of internal control." },
        { controlId: "CC2.3", category: "Security - Communication and Information", subcategory: "COSO Principle 15", title: "Communicates externally", description: "The entity communicates with external parties regarding matters affecting the functioning of internal control." },
        // CC3 - Risk Assessment
        { controlId: "CC3.1", category: "Security - Risk Assessment", subcategory: "COSO Principle 6", title: "Specifies suitable objectives", description: "The entity specifies objectives with sufficient clarity to enable the identification and assessment of risks relating to objectives." },
        { controlId: "CC3.2", category: "Security - Risk Assessment", subcategory: "COSO Principle 7", title: "Identifies and analyzes risk", description: "The entity identifies risks to the achievement of its objectives across the entity and analyzes risks as a basis for determining how the risks should be managed." },
        { controlId: "CC3.3", category: "Security - Risk Assessment", subcategory: "COSO Principle 8", title: "Considers potential for fraud", description: "The entity considers the potential for fraud in assessing risks to the achievement of objectives." },
        { controlId: "CC3.4", category: "Security - Risk Assessment", subcategory: "COSO Principle 9", title: "Identifies and analyzes significant change", description: "The entity identifies and assesses changes that could significantly impact the system of internal control." },
        // CC4 - Monitoring Activities
        { controlId: "CC4.1", category: "Security - Monitoring Activities", subcategory: "COSO Principle 16", title: "Selects and develops ongoing and/or separate evaluations", description: "The entity selects, develops, and performs ongoing and/or separate evaluations to ascertain whether the components of internal control are present and functioning." },
        { controlId: "CC4.2", category: "Security - Monitoring Activities", subcategory: "COSO Principle 17", title: "Evaluates and communicates deficiencies", description: "The entity evaluates and communicates internal control deficiencies in a timely manner to those parties responsible for taking corrective action, including senior management and the board of directors, as appropriate." },
        // CC5 - Control Activities
        { controlId: "CC5.1", category: "Security - Control Activities", subcategory: "COSO Principle 10", title: "Selects and develops control activities", description: "The entity selects and develops control activities that contribute to the mitigation of risks to the achievement of objectives to acceptable levels." },
        { controlId: "CC5.2", category: "Security - Control Activities", subcategory: "COSO Principle 11", title: "Selects and develops general controls over technology", description: "The entity also selects and develops general control activities over technology to support the achievement of objectives." },
        { controlId: "CC5.3", category: "Security - Control Activities", subcategory: "COSO Principle 12", title: "Deploys through policies and procedures", description: "The entity deploys control activities through policies that establish what is expected and in procedures that put policies into action." },
        // CC6 - Logical and Physical Access Controls
        { controlId: "CC6.1", category: "Security - Logical and Physical Access", subcategory: "Logical Access", title: "Security software, infrastructure, and architectures", description: "The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events." },
        { controlId: "CC6.2", category: "Security - Logical and Physical Access", subcategory: "Logical Access", title: "Authentication and access", description: "Prior to issuing system credentials and granting system access, the entity registers and authorizes new internal and external users whose access is administered by the entity." },
        { controlId: "CC6.3", category: "Security - Logical and Physical Access", subcategory: "Logical Access", title: "Access removal", description: "The entity authorizes, modifies, or removes access to data, software, functions, and other protected information assets based on roles, responsibilities, or the system design and changes." },
        { controlId: "CC6.4", category: "Security - Logical and Physical Access", subcategory: "Physical Access", title: "Physical access restrictions", description: "The entity restricts physical access to facilities and protected information assets to authorized personnel." },
        { controlId: "CC6.5", category: "Security - Logical and Physical Access", subcategory: "Physical Access", title: "Physical access to assets", description: "The entity discontinues logical and physical protections over physical assets only after the ability to read or recover data and software from those assets has been diminished." },
        { controlId: "CC6.6", category: "Security - Logical and Physical Access", subcategory: "External Threats", title: "Security events against threats", description: "The entity implements logical access security measures to protect against threats from sources outside its system boundaries." },
        { controlId: "CC6.7", category: "Security - Logical and Physical Access", subcategory: "Data Transmission", title: "Information transmission", description: "The entity restricts the transmission, movement, and removal of information to authorized internal and external users and processes, and protects it during transmission." },
        { controlId: "CC6.8", category: "Security - Logical and Physical Access", subcategory: "Malware", title: "Malicious software prevention", description: "The entity implements controls to prevent or detect and act upon the introduction of unauthorized or malicious software." },
        // CC7 - System Operations
        { controlId: "CC7.1", category: "Security - System Operations", subcategory: "Detection", title: "Vulnerability detection", description: "To meet its objectives, the entity uses detection and monitoring procedures to identify changes to configurations that result in the introduction of new vulnerabilities, and susceptibilities to newly discovered vulnerabilities." },
        { controlId: "CC7.2", category: "Security - System Operations", subcategory: "Incident Response", title: "Security incident monitoring", description: "The entity monitors system components and the operation of those components for anomalies that are indicative of malicious acts, natural disasters, and errors affecting the entity's ability to meet its objectives." },
        { controlId: "CC7.3", category: "Security - System Operations", subcategory: "Incident Response", title: "Security incident evaluation", description: "The entity evaluates security events to determine whether they could or have resulted in a failure of the entity to meet its objectives and, if so, takes actions to prevent or address such failures." },
        { controlId: "CC7.4", category: "Security - System Operations", subcategory: "Incident Response", title: "Security incident response", description: "The entity responds to identified security incidents by executing a defined incident response program to understand, contain, remediate, and communicate security incidents." },
        { controlId: "CC7.5", category: "Security - System Operations", subcategory: "Recovery", title: "Recovery from incidents", description: "The entity identifies, develops, and implements activities to recover from identified security incidents." },
        // CC8 - Change Management
        { controlId: "CC8.1", category: "Security - Change Management", subcategory: "Change Management", title: "Infrastructure and software changes", description: "The entity authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures to meet its objectives." },
        // CC9 - Risk Mitigation
        { controlId: "CC9.1", category: "Security - Risk Mitigation", subcategory: "Risk Mitigation", title: "Vendor risk management", description: "The entity identifies, selects, and develops risk mitigation activities for risks arising from potential business disruptions." },
        { controlId: "CC9.2", category: "Security - Risk Mitigation", subcategory: "Risk Mitigation", title: "Business continuity", description: "The entity assesses and manages risks associated with vendors and business partners." },
        // A1 - Availability
        { controlId: "A1.1", category: "Availability", subcategory: "System Availability", title: "System availability management", description: "The entity maintains, monitors, and evaluates current processing capacity and use of system components to manage capacity demand and to enable the implementation of additional capacity." },
        { controlId: "A1.2", category: "Availability", subcategory: "Recovery", title: "Environmental and data recovery", description: "The entity authorizes, designs, develops or acquires, implements, operates, approves, maintains, and monitors environmental protections, software, data backup processes, and recovery infrastructure." },
        { controlId: "A1.3", category: "Availability", subcategory: "Business Continuity", title: "Business continuity testing", description: "The entity tests recovery plan procedures supporting system recovery to meet its objectives." },
        // PI1 - Processing Integrity
        { controlId: "PI1.1", category: "Processing Integrity", subcategory: "Data Processing", title: "Processing accuracy and completeness", description: "The entity implements policies and procedures over system processing to result in products, services, and reporting to meet the entity's objectives." },
        { controlId: "PI1.2", category: "Processing Integrity", subcategory: "Data Processing", title: "Input validation", description: "The entity implements policies and procedures over system inputs to result in products, services, and reporting to meet the entity's objectives." },
        { controlId: "PI1.3", category: "Processing Integrity", subcategory: "Data Processing", title: "Processing error handling", description: "The entity implements policies and procedures over system processing to result in products, services, and reporting to meet the entity's objectives." },
        { controlId: "PI1.4", category: "Processing Integrity", subcategory: "Output", title: "Output completeness and accuracy", description: "The entity implements policies and procedures to make available or deliver output completely, accurately, and timely in accordance with specifications to meet the entity's objectives." },
        { controlId: "PI1.5", category: "Processing Integrity", subcategory: "Data Retention", title: "Data storage and retention", description: "The entity implements policies and procedures to store inputs, items in processing, and outputs completely, accurately, and timely in accordance with system specifications." },
        // C1 - Confidentiality
        { controlId: "C1.1", category: "Confidentiality", subcategory: "Confidential Information", title: "Confidential information identification", description: "The entity identifies and maintains confidential information to meet the entity's objectives related to confidentiality." },
        { controlId: "C1.2", category: "Confidentiality", subcategory: "Confidential Information", title: "Confidential information disposal", description: "The entity disposes of confidential information to meet the entity's objectives related to confidentiality." },
        // P1-P8 - Privacy
        { controlId: "P1.1", category: "Privacy", subcategory: "Notice", title: "Privacy notice", description: "The entity provides notice to data subjects about its privacy practices." },
        { controlId: "P2.1", category: "Privacy", subcategory: "Choice and Consent", title: "Privacy choice and consent", description: "The entity communicates choices available regarding the collection, use, retention, disclosure, and disposal of personal information to data subjects." },
        { controlId: "P3.1", category: "Privacy", subcategory: "Collection", title: "Personal information collection", description: "Personal information is collected consistent with the entity's objectives related to privacy." },
        { controlId: "P3.2", category: "Privacy", subcategory: "Collection", title: "Explicit consent for sensitive information", description: "For information requiring explicit consent, the entity communicates the need for such consent." },
        { controlId: "P4.1", category: "Privacy", subcategory: "Use, Retention, and Disposal", title: "Personal information use limitation", description: "The entity limits the use of personal information to the purposes identified in the entity's objectives." },
        { controlId: "P4.2", category: "Privacy", subcategory: "Use, Retention, and Disposal", title: "Personal information retention", description: "The entity retains personal information consistent with the entity's objectives related to privacy." },
        { controlId: "P4.3", category: "Privacy", subcategory: "Use, Retention, and Disposal", title: "Personal information disposal", description: "The entity securely disposes of personal information to meet the entity's objectives related to privacy." },
        { controlId: "P5.1", category: "Privacy", subcategory: "Access", title: "Personal information access", description: "The entity grants identified and authenticated data subjects the ability to access their stored personal information for review." },
        { controlId: "P5.2", category: "Privacy", subcategory: "Access", title: "Personal information correction", description: "The entity corrects, amends, or appends personal information based on information provided by data subjects." },
        { controlId: "P6.1", category: "Privacy", subcategory: "Disclosure and Notification", title: "Personal information disclosure", description: "The entity discloses personal information to third parties with the consent of the data subjects." },
        { controlId: "P6.2", category: "Privacy", subcategory: "Disclosure and Notification", title: "Third party privacy practices", description: "The entity creates and retains a complete, accurate, and timely record of authorized disclosures of personal information." },
        { controlId: "P6.3", category: "Privacy", subcategory: "Disclosure and Notification", title: "Notification of third party access", description: "The entity notifies affected data subjects, regulators, and others when a breach or suspected breach of privacy occurs." },
        { controlId: "P6.4", category: "Privacy", subcategory: "Disclosure and Notification", title: "Privacy breach notification", description: "The entity provides data subjects with an accounting of the personal information held." },
        { controlId: "P6.5", category: "Privacy", subcategory: "Disclosure and Notification", title: "Accounting of disclosures", description: "The entity creates and retains a complete, accurate, and timely record of detected or reported unauthorized access." },
        { controlId: "P6.6", category: "Privacy", subcategory: "Disclosure and Notification", title: "Privacy rights notification", description: "The entity notifies data subjects if the entity makes material changes to the entity's privacy notice." },
        { controlId: "P6.7", category: "Privacy", subcategory: "Disclosure and Notification", title: "Unauthorized access notification", description: "The entity provides a means for data subjects to communicate regarding privacy issues or complaints." },
        { controlId: "P7.1", category: "Privacy", subcategory: "Quality", title: "Personal information accuracy", description: "The entity collects and maintains accurate, up-to-date, complete, and relevant personal information necessary to meet the entity's objectives." },
        { controlId: "P8.1", category: "Privacy", subcategory: "Monitoring and Enforcement", title: "Privacy compliance monitoring", description: "The entity implements a process for receiving, addressing, resolving, and communicating the resolution of inquiries, complaints, and disputes from data subjects." },
      ]
      
      // Insert ISO 27001 controls
      const iso27001Records = iso27001Controls.map((c, i) => ({
        frameworkCode: "iso-27001",
        controlId: c.controlId,
        category: c.category,
        subcategory: c.subcategory,
        title: c.title,
        description: c.description,
        isRequired: true,
        sortOrder: i,
      }))
      
      // Insert SOC 2 controls
      const soc2Records = soc2Controls.map((c, i) => ({
        frameworkCode: "soc-2",
        controlId: c.controlId,
        category: c.category,
        subcategory: c.subcategory,
        title: c.title,
        description: c.description,
        isRequired: true,
        sortOrder: i,
      }))
      
      await db.insert(securityStandardControls).values(iso27001Records).onConflictDoNothing()
      await db.insert(securityStandardControls).values(soc2Records).onConflictDoNothing()
      
      console.log(`✅ Security standard controls seeded:`)
      console.log(`  - ISO 27001:2022: ${iso27001Records.length} controls`)
      console.log(`  - SOC 2: ${soc2Records.length} criteria`)
    }
    
    console.log("\n✅ All seed complete!")
  } catch (error) {
    console.error("❌ Seed failed:", error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seed()

