import unittest
from unittest.mock import MagicMock, patch

from backend import database


class TestDatabase(unittest.TestCase):
    @patch.dict("os.environ", {"DATABASE_URL": "postgresql://placeholder"})
    @patch("backend.database.psycopg.connect")
    def test_parameterized_gold_query_and_connection_cleanup(self, connect):
        connection = MagicMock()
        connect.return_value.__enter__.return_value = connection
        connection.execute.return_value.fetchone.return_value = {"account_id": 42}
        self.assertEqual(database.fetch_account(42), {"account_id": 42})
        sql, parameters = connection.execute.call_args.args
        self.assertEqual(parameters, (42,))
        self.assertEqual(sql, 'SELECT account_id, "I", "S", "F", "H", "B", "P" '
                         'FROM public.gold_account_metrics WHERE account_id = %s')
        self.assertEqual(connect.call_args.kwargs["connect_timeout"], 10)
        connect.return_value.__exit__.assert_called_once()

    @patch.dict("os.environ", {}, clear=True)
    def test_missing_configuration(self):
        with self.assertRaises(database.DatabaseUnavailable):
            database.fetch_account(42)

    @patch("backend.database.connect")
    def test_health_query(self, connect):
        database.check_health()
        connect.return_value.__enter__.return_value.execute.assert_called_once_with("SELECT 1")
