package application;


import game.Board;
import gui.Gui;
import gui.IL;


public class Main {
    public static boolean multRunning = false, isServer = true;
    public static String serverIp = "127.0.0.1";
    public static int port = 5000;
    public static boolean connected, waiting;


    public static void main(String[] args) {

        IL.load();
        Board b = new Board();
        Gui g = new Gui();
        g.create();

        Board.refreshMoves();


    }
}
