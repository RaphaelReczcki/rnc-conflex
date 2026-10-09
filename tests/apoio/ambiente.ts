// Roda antes de cada arquivo de teste de integração: aponta o app para o banco de teste.
import "dotenv/config";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DIRECT_URL = process.env.TEST_DATABASE_URL;
