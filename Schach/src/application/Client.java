package application;

import game.*;
import gui.Gui;
import gui.IL;

import java.net.*;
import java.io.*;
import java.util.Timer;
import java.util.TimerTask;

public class Client {

    private static Socket socket = null;
    private static DataOutputStream out = null;
    private static DataInputStream in = null;
    private static Timer t;


    public Client(String address, int port) {

        setup(address, port);

        receive();
    }

    public static void setup(String address, int port) {

        try {
            socket = new Socket(address, port);
            System.out.println("Connected");

            out = new DataOutputStream(socket.getOutputStream());
            Gui.changeColor.setVisible(false);
            Main.connected = true;
            Main.waiting = false;
            Gui.ipInput.setEnabled(false);
            Gui.portInput.setEnabled(false);
        } catch (IOException e) {
            System.out.println("Connection failed");
        }

    }

    public static void receive() {

        try {
            in = new DataInputStream(new BufferedInputStream(socket.getInputStream()));

        } catch (IOException e) {
            e.printStackTrace();
        }


        t = new Timer();
        t.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                try {

                    String s = in.readUTF();

                    if (s.equals("Schwarz")) {
                        Board.serverWhite = false;
                    } else if (s.equals("Weiss")) {
                        Board.serverWhite = true;
                    } else if (s.equals("Laeufer")) {
                        if (Board.serverWhite) {
                            Board.umwandelnW = new Laeufer(true, IL.figurenW[2]);
                        } else {
                            Board.umwandelnB = new Laeufer(false, IL.figurenB[2]);
                        }
                    } else if (s.equals("Turm")) {
                        if (Board.serverWhite) {
                            Board.umwandelnW = new Turm(true, IL.figurenW[4]);
                        } else {
                            Board.umwandelnB = new Turm(false, IL.figurenB[4]);
                        }
                    } else if (s.equals("Springer")) {
                        if (Board.serverWhite) {
                            Board.umwandelnW = new Springer(true, IL.figurenW[3]);
                        } else {
                            Board.umwandelnB = new Springer(false, IL.figurenB[3]);
                        }
                    } else if (s.equals("Dame")) {
                        if (Board.serverWhite) {
                            Board.umwandelnW = new Dame(true, IL.figurenW[1]);
                        } else {
                            Board.umwandelnB = new Dame(false, IL.figurenB[1]);
                        }
                    } else {
                        Board.moveFromTo(s);
                    }

                } catch (IOException e) {
                    System.out.println("Connection was closed");
                    close();
                }
            }
        }, 200, 200);

    }

    public static void send(String s) {
        try {
            out.writeUTF(s);
        } catch (IOException e) {
            System.out.println("Connection was closed");
            close();
        }
    }

    public static void close() {
        try {
            t.cancel();
            in.close();
            out.close();
            socket.close();
        } catch (IOException i) {
            System.out.println("Error occured while closing connections");
        }
    }

}